import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(file, dependencies) {
  let loader;
  const resource = {
    data: null, error: null, loading: false,
    reload: async () => { resource.data = await loader(); return resource.data; },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, { exports, FormData, require: name => {
    if (name === '@/hooks/useBackendResource') return { useBackendResource: callback => { loader = callback; return resource; } };
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return {
    module: exports,
    ready: async hook => { exports[hook](); await resource.reload(); return exports[hook](); },
  };
}

test('sessions preserve server identities and revoke the current session remotely', async () => {
  const events = [];
  const app = harness('../components/sessions/store.ts', { '@/services/api': {
    authApi: {
      getSessions: async () => ({ sessions: [{ id: 'server-id', device: 'Android', loginTime: 'server-time', isCurrent: true }] }),
      removeSession: async id => events.push(id),
    }, clearToken: async () => events.push('cleared'),
  } });
  const sessions = await app.ready('useSessions');
  assert.equal(sessions.sessions[0].startedAt, 'server-time');
  await sessions.signOutSession('server-id');
  assert.deepEqual(events, ['server-id', 'cleared']);
});

test('a rejected session revocation does not pretend the device was signed out', async () => {
  let cleared = false;
  const app = harness('../components/sessions/store.ts', { '@/services/api': {
    authApi: {
      getSessions: async () => ({ sessions: [{ id: 'server-id', device: 'Web', isCurrent: true }] }),
      removeSession: async () => { throw new Error('Revocation failed'); },
    }, clearToken: async () => { cleared = true; },
  } });
  const sessions = await app.ready('useSessions');
  await assert.rejects(sessions.signOutSession('server-id'), /Revocation failed/);
  assert.equal(cleared, false);
});

test('inbox read state is mapped from the real read field and persisted through the API', async () => {
  const notifications = [{ id: 7, title: 'Notice', message: 'From backend', read: false, created_at: 'server-time' }];
  const app = harness('../components/notifications/store.ts', { '@/services/api': { notificationApi: {
    list: async () => notifications,
    markAsRead: async id => { assert.equal(id, '7'); notifications[0].read = true; },
  } } });
  const inbox = await app.ready('useNotifications');
  assert.equal(inbox.unreadCount, 1);
  await inbox.markRead('7');
  assert.equal(app.module.useNotifications().unreadCount, 0);
});

test('passkeys are not manufactured from platform names or fabricated timestamps', async () => {
  let refreshed = false;
  const app = harness('../components/passkeys/store.ts', {
    '@/services/api': { userApi: {
      me: async () => ({ passkey_credentials: [{ id: 'registered-id', transports: ['internal'] }] }),
      passkeyRegisterOptions: async () => ({ challenge: 'server-challenge' }),
      passkeyRegisterVerify: async () => ({ verified: false }),
    } },
    '@/services/passkeys': { createCredential: async options => ({ challenge: options.challenge }) },
    '@/services/refresh': { refreshBackendData: () => { refreshed = true; } },
  });
  const keys = await app.ready('usePasskeys');
  assert.equal(keys.passkeys[0].id, 'registered-id'); assert.equal(keys.passkeys[0].createdAt, '');
  await assert.rejects(keys.createPasskey(), /did not verify/);
  assert.equal(refreshed, false);
});

test('profile updates keep server country rather than overwriting it with a placeholder', async () => {
  let payload;
  const app = harness('../components/settings/profile.ts', {
    '@/services/api': { userApi: {
      me: async () => ({ first_name: 'Existing', last_name: 'Name', username: 'real_user', country: 'IN' }),
      updateProfile: async value => { payload = value; },
    } },
    '@/services/refresh': { refreshBackendData() {} },
  });
  await app.module.saveProfile({ name: 'New Person Name', username: 'real_user' });
  assert.equal(payload.firstName, 'New'); assert.equal(payload.lastName, 'Person Name');
  assert.equal(payload.country, 'IN'); assert.equal('username' in payload, false);
});

function supportHarness(api) {
  return harness('../components/help/tickets.ts', {
    react: {}, 'expo-router': {}, 'react-native': {},
    '@/services/api': { supportApi: api, getMediaUrl: value => value, getToken: async () => 'session', onSessionExpired() {} },
    '@/services/uploads': { appendImage() {} }, '@/services/refresh': { onBackendRefresh() {} },
  }).module;
}

test('unsupported multiple attachments and videos fail before a support submission', async () => {
  let called = false;
  const support = supportHarness({ create: async () => { called = true; } });
  await assert.rejects(support.createTicket('Subject', 'Description', [{ kind: 'MP4' }]), /one image/);
  await assert.rejects(support.createTicket('Subject', 'Description', [{ kind: 'PNG' }, { kind: 'PNG' }]), /one image/);
  assert.equal(called, false);
});

test('support returns the actual server ticket and starts no local fake conversation', async () => {
  const support = supportHarness({
    create: async () => ({ ticketId: 'actual-ticket' }),
    getDetails: async () => ({
      ticket: { id: 'actual-ticket', title: 'Actual title', message: 'Original', status: 'PENDING', created_at: '2026-11-11' },
      messages: [{ id: 'message-id', message: 'Original', is_admin: false, created_at: '2026-11-11' }],
    }),
  });
  const ticket = await support.createTicket('Subject', 'Description', []);
  assert.equal(ticket.id, 'actual-ticket'); assert.equal(ticket.status, 'Open');
  assert.equal(ticket.messages.length, 1); assert.equal(ticket.messages[0].author, 'user');
});

test('closed support tickets cannot accept replies', async () => {
  let replied = false;
  const support = supportHarness({
    getDetails: async () => ({ ticket: { id: 'closed', status: 'CLOSED', created_at: '2026-11-11' }, messages: [] }),
    reply: async () => { replied = true; },
  });
  await assert.rejects(support.sendTicketMessage('closed', 'Reply', []), /closed/);
  assert.equal(replied, false);
});

test('KYC refuses missing document numbers and expiry dates', () => {
  const { module } = harness('../components/kyc/model.ts', {});
  const errors = module.validatePersonal({
    name: 'Test User', fatherName: 'Parent Name', dob: '1990-01-01', language: 'English',
  }, new Date('2026-11-11'));
  assert.ok(errors.documentNumber); assert.ok(errors.idExpiry);
});

test('KYC accepts real form fields but rejects expired identity documents', () => {
  const { module } = harness('../components/kyc/model.ts', {});
  const personal = {
    name: 'Test User', fatherName: 'Parent Name', dob: '1990-01-01', language: 'English',
    documentNumber: 'TEST-ID-123', idExpiry: '2030-12-31',
  };
  assert.equal(Object.keys(module.validatePersonal(personal, new Date('2026-11-11'))).length, 0);
  assert.ok(module.validatePersonal({ ...personal, idExpiry: '2025-01-01' }, new Date('2026-11-11')).idExpiry);
});

test('KYC exposes no local timer that invents approval or rejection', () => {
  const { module } = harness('../components/kyc/model.ts', {});
  assert.equal('kycReviewStatus' in module, false);
  assert.equal('kycReviewDelay' in module, false);
});

test('two-factor configuration contains no shared fake secret or canned accepted code', () => {
  const { module } = harness('../components/twofa/demo.ts', {});
  assert.deepEqual(Object.keys(module), ['CODE_LENGTH']);
  assert.equal(module.CODE_LENGTH, 6);
});

test('uncertain financial requests retain their recovery key after reopening a sheet', async () => {
  const storage = new Map(), keys = [];
  const dependencies = {
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key) ?? null,
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async key => storage.delete(key),
    },
    'expo-crypto': {
      randomUUID: () => 'persistent-operation-key',
      CryptoDigestAlgorithm: { SHA256: 'SHA256' },
      digestStringAsync: async () => 'fixture-account-scope',
    },
  };
  const first = harness('../services/financialRequests.ts', dependencies).module;
  await assert.rejects(first.financialRequest('token', '/wallet/send', { amount: 1 }, async key => {
    keys.push(key); throw Error('Lost response');
  }));
  const reopened = harness('../services/financialRequests.ts', dependencies).module;
  await reopened.financialRequest('token', '/wallet/send', { amount: 1 }, async key => { keys.push(key); return 'receipt'; });
  assert.equal(keys[0], keys[1]);
  assert.equal(storage.size, 0);
});
