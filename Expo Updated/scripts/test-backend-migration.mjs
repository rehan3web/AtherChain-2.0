import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { createHash, randomUUID } from 'node:crypto';

function load(relative, dependencies, globals = {}) {
  const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: name => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
    setTimeout, clearTimeout, AbortController, FormData, URL, ...globals,
  });
  return exports;
}

function apiHarness({ platform = 'web', response, token = 'test-token', timer,
  env = { EXPO_PUBLIC_API_URL: platform === 'web' ? '/api' : 'https://backend.test' } } = {}) {
  const storage = new Map(token ? [['ather_token', token]] : []);
  const secure = new Map(token ? [['ather_token', token]] : []);
  const calls = [];
  const asyncStorage = {
    getItem: async key => storage.get(key) ?? null,
    setItem: async (key, value) => storage.set(key, value),
    removeItem: async key => storage.delete(key),
  };
  const crypto = {
    randomUUID,
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digestStringAsync: async (_algorithm, value) => createHash('sha256').update(value).digest('hex'),
  };
  const api = load('../services/api.ts', {
    '@react-native-async-storage/async-storage': asyncStorage,
    'react-native': { Platform: { OS: platform } },
    'expo-secure-store': {
      getItemAsync: async key => secure.get(key) ?? null,
      setItemAsync: async (key, value) => secure.set(key, value),
      deleteItemAsync: async key => secure.delete(key),
    },
    'expo-crypto': crypto,
    './financialRequests': load('../services/financialRequests.ts', {
      '@react-native-async-storage/async-storage': asyncStorage, 'expo-crypto': crypto,
    }, { atob }),
    './refresh': { refreshBackendData() {} },
    '../constants/apiConfig': load('../constants/apiConfig.ts', {
      'react-native': { Platform: { OS: platform } },
    }, { process: { env } }),
  }, {
    process: { env },
    ...(timer ? { setTimeout: timer } : {}),
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      if (options.signal.aborted) {
        const error = new Error('aborted'); error.name = 'AbortError'; throw error;
      }
      const validReceipt = url.endsWith('/wallet/send') ? { hash: 'committed-send' }
        : url.endsWith('/swap/execute') ? { success: true, status: 'completed', hash: 'committed-swap', txId: 'mongo-id',
          receipt: { fromAmount: 12.5, toAmount: 25, rate: 2, createdAt: new Date().toISOString() } }
          : url.endsWith('/mining/start') ? { reward: 2, newBalance: 102 }
            : url.endsWith('/mining/claim-boost') ? { currentCycleBoosts: 1 } : { ok: true };
      const result = response ? await response(url, options) : { data: validReceipt };
      return {
        ok: (result.status ?? 200) < 400, status: result.status ?? 200,
        text: async () => result.raw ?? JSON.stringify(result.data ?? { ok: true }),
      };
    },
  });
  return { api, calls, storage, secure };
}

test('configured requests use the same-origin proxy and bearer token', async () => {
  const { api, calls } = apiHarness();
  await api.walletApi.stats();
  assert.equal(calls[0].url, '/api/wallet/stats');
  assert.equal(calls[0].headers.Authorization, 'Bearer test-token');
  assert.equal(calls[0].method, 'GET');
});

test('limited session deletion uses its explicit scoped token without storing it or clearing a normal session', async () => {
  const { api, calls, storage } = apiHarness({ response: () => ({ status: 401, data: { message: 'Expired management token' } }) });
  await assert.rejects(api.authApi.removeSessionManaged('old/session', 'limited-token'), /Expired management token/);
  assert.equal(calls[0].url, '/api/auth/sessions/old%2Fsession');
  assert.equal(calls[0].headers.Authorization, 'Bearer limited-token');
  assert.equal(storage.get('ather_token'), 'test-token');
});

test('web and native requests use the configured API URL rather than an old fallback', async () => {
  for (const platform of ['web', 'ios', 'android']) {
    const { api, calls } = apiHarness({ platform, env: { EXPO_PUBLIC_API_URL: ' https://configured.test/v1/// ' } });
    await api.userApi.me();
    assert.equal(calls[0].url, 'https://configured.test/v1/user/me');
  }
});

test('missing API configuration fails explicitly without sending a request', async () => {
  for (const value of [undefined, '', '   ']) {
    const { api, calls } = apiHarness({ env: { EXPO_PUBLIC_API_URL: value } });
    await assert.rejects(api.userApi.me(), /Set EXPO_PUBLIC_API_URL/);
    assert.equal(calls.length, 0);
  }
});

test('invalid API URLs are rejected and native apps cannot use a relative web proxy', async () => {
  for (const value of ['ftp://backend.test', 'https://user:password@backend.test', 'https://backend.test?token=value', 'https://backend.test#fragment', 'not-a-url', '/api']) {
    const { api, calls } = apiHarness({ platform: 'android', env: { EXPO_PUBLIC_API_URL: value } });
    await assert.rejects(api.userApi.me(), /full HTTP\(S\) backend URL/);
    assert.equal(calls.length, 0);
  }
});

test('public login sends actual credentials and no stale bearer token', async () => {
  const { api, calls } = apiHarness();
  await api.authApi.login('real-user', 'real-password');
  assert.equal(calls[0].url, '/api/auth/login');
  assert.deepEqual(JSON.parse(calls[0].body), { emailOrUsername: 'real-user', password: 'real-password' });
  assert.equal(calls[0].headers.Authorization, undefined);
});

test('native tokens are held in SecureStore, not ordinary storage', async () => {
  const { api, storage, secure } = apiHarness({ platform: 'ios', token: null });
  await api.setToken('native-session');
  assert.equal(secure.get('ather_token'), 'native-session');
  assert.equal(storage.has('ather_token'), false);
  await api.userApi.me();
  assert.equal(await api.getToken(), 'native-session');
});

test('a missing token cannot reach an authenticated endpoint', async () => {
  const { api, calls } = apiHarness({ token: null });
  await assert.rejects(api.walletApi.send('recipient', 2), /sign in/i);
  assert.equal(calls.length, 0);
});

test('unauthorized responses revoke local access and notify subscribers', async () => {
  const { api, storage } = apiHarness({ response: () => ({ status: 401, data: { message: 'Session expired' } }) });
  let expired = 0;
  api.onSessionExpired(() => expired++);
  await assert.rejects(api.userApi.me(), /Session expired/);
  assert.equal(storage.has('ather_token'), false);
  assert.equal(expired, 1);
});

test('blocked responses revoke access rather than simulating a login', async () => {
  const { api, storage } = apiHarness({ response: () => ({ status: 403, data: { code: 'USER_BLOCKED', message: 'Blocked' } }) });
  await assert.rejects(api.userApi.me(), /Blocked/);
  assert.equal(storage.has('ather_token'), false);
});

test('failed transfers preserve backend errors and cannot resolve as success', async () => {
  const { api } = apiHarness({ response: () => ({ status: 400, data: { message: 'Insufficient ATH' } }) });
  await assert.rejects(api.walletApi.send('recipient', 100), /Insufficient ATH/);
});

test('malformed JSON and timeouts are explicit errors', async () => {
  const malformed = apiHarness({ response: () => ({ raw: '<html>error</html>' }) });
  await assert.rejects(malformed.api.walletApi.stats(), /invalid response/);
  const timeout = apiHarness({ timer: callback => { callback(); return 1; } });
  await assert.rejects(timeout.api.walletApi.stats(), /did not respond in time/);
});

test('multipart uploads retain their boundary and use authenticated requests', async () => {
  const { api, calls } = apiHarness();
  const form = new FormData(); form.append('full_name', 'Test Applicant');
  await api.kycApi.submit(form);
  assert.equal(calls[0].url, '/api/user/kyc/submit');
  assert.equal(calls[0].body, form);
  assert.equal(calls[0].headers['Content-Type'], undefined);
});

test('registration reuses a persistent device ID and verifies real email OTPs', async () => {
  const { api, calls } = apiHarness();
  await api.authApi.register({ email: 'fixture@example.test' });
  await api.authApi.register({ email: 'fixture@example.test' });
  const first = JSON.parse(calls[0].body), second = JSON.parse(calls[1].body);
  assert.equal(first.deviceId, second.deviceId);
  await api.authApi.verifyEmail('fixture@example.test', '123456');
  assert.deepEqual(JSON.parse(calls[2].body), { email: 'fixture@example.test', otp: '123456' });
});

test('mining operations map only to the supported server routes', async () => {
  const { api, calls } = apiHarness();
  await api.miningApi.status(); await api.miningApi.validate();
  await api.miningApi.start(); await api.miningApi.claimBoost();
  assert.deepEqual(calls.map(call => call.url), [
    '/api/mining/status', '/api/mining/validate', '/api/mining/start', '/api/mining/claim-boost',
  ]);
  assert.equal('stop' in api.miningApi, false);
});

test('swap and send payloads match the backend contract', async () => {
  const { api, calls } = apiHarness();
  await api.swapApi.execute(12.5); await api.walletApi.send('alice', 4);
  assert.deepEqual(JSON.parse(calls[0].body), { amountAT: 12.5, fromToken: 'AT', toToken: 'ATH' });
  assert.deepEqual(JSON.parse(calls[1].body), { recipient: 'alice', amount: 4 });
  assert.match(calls[0].headers['Idempotency-Key'], /^[\w-]{16,128}$/);
  assert.match(calls[1].headers['Idempotency-Key'], /^[\w-]{16,128}$/);
});

test('security, sessions, referrals, profile and inbox use real endpoints', async () => {
  const { api, calls } = apiHarness();
  await api.userApi.changePassword('old', 'new'); await api.userApi.enable2FA('654321');
  await api.userApi.disable2FA('123456'); await api.authApi.verify2FA('user', '123456');
  await api.authApi.approveQRLogin('opaque-token'); await api.authApi.removeSession('a/b');
  await api.referralApi.stats(); await api.notificationApi.markAsRead('a/b');
  assert.deepEqual(calls.map(call => call.url), [
    '/api/user/password', '/api/user/2fa/verify', '/api/user/2fa/disable',
    '/api/auth/verify-2fa-login', '/api/auth/qr/approve', '/api/auth/sessions/a%2Fb',
    '/api/referral/stats', '/api/notifications/a%2Fb/read',
  ]);
});

test('transaction history loads all backend pages, not fabricated local records', async () => {
  const pages = [];
  const transactions = load('../services/transactions.ts', { './api': {
    transactionApi: { list: async page => {
      pages.push(page);
      return { data: [{ id: String(page) }], meta: { totalPages: 3 } };
    } },
  } });
  const items = await transactions.getAllTransactions();
  assert.deepEqual(pages, [1, 2, 3]);
  assert.equal(items.length, 3);
});

test('history receipts retain real references and pending status', () => {
  const transactions = load('../services/transactions.ts', { './api': {} });
  const receipt = transactions.backendReceipt({
    id: 'db-id', timestamp: '2026-11-11T12:00:00Z', txHash: 'real-reference',
    type: 'send', amount: '2.75', status: 'pending', toAddress: 'recipient',
  });
  assert.equal(receipt.reference, 'real-reference');
  assert.equal(receipt.status, 'pending');
  assert.equal(receipt.demo, false);
  assert.equal(receipt.amount, 2.75);
});

test('quotes apply the actual configurable rate rather than assuming 1:1', () => {
  const model = load('../components/wallet/swap-model.ts', {});
  const quote = model.swapQuote(...model.SWAP_COINS, 10, 0.37);
  assert.equal(quote.receiveAmount, 3.7);
  assert.throws(() => model.swapQuote(...model.SWAP_COINS, 10, -1), /invalid swap rate/);
});

test('internal ATH ledger addresses can be entered and copied without case changes', () => {
  const recipient = load('../components/wallet/recipient.ts', {});
  const address = 'ATH_' + 'A1'.repeat(20);
  assert.equal(recipient.recipientError('address', address), null);
  assert.equal(recipient.normalizeRecipient('address', ` ${address} `).value, address);
  assert.ok(recipient.recipientError('address', 'ATH_INVALID'));
});
