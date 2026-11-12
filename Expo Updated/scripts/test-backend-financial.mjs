import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../services/financialRequests.ts', import.meta.url), 'utf8');
function client(storage = new Map()) {
  const exports = {};
  const dependencies = {
    '@react-native-async-storage/async-storage': {
      getItem: async key => storage.get(key) ?? null,
      setItem: async (key, value) => storage.set(key, value),
      removeItem: async key => storage.delete(key),
    },
    'expo-crypto': {
      randomUUID, CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
      digestStringAsync: async (_algorithm, value) => createHash('sha256').update(value).digest('hex'),
    },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText, { exports, atob, require: name => dependencies[name] });
  return exports;
}
const path = '/wallet/send', body = { recipient: 'ATH_RECIPIENT', amount: 20 };
test('an uncertain payment keeps the same key across an app restart', async () => {
  const storage = new Map(), keys = [];
  await assert.rejects(client(storage).financialRequest('token', path, body, async key => {
    keys.push(key); throw Error('Lost response');
  }));
  await client(storage).financialRequest('token', path, body, async key => { keys.push(key); return { hash: 'committed' }; });
  assert.equal(keys[0], keys[1]); assert.equal(storage.size, 0);
});
test('concurrent clicks reuse one request and one key', async () => {
  const api = client(); let count = 0, finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const send = async () => { count++; await pending; return 'receipt'; };
  const first = api.financialRequest('token', path, body, send);
  const second = api.financialRequest('token', path, body, send);
  await new Promise(resolve => setTimeout(resolve, 0)); finish();
  assert.deepEqual(await Promise.all([first, second]), ['receipt', 'receipt']); assert.equal(count, 1);
});
test('a different payment is blocked while the earlier result is uncertain', async () => {
  const api = client(); await assert.rejects(api.financialRequest('token', path, body, async () => { throw Error('timeout'); }));
  let sent = false;
  await assert.rejects(api.financialRequest('token', path, { ...body, amount: 30 }, async () => { sent = true; }), /original details/);
  assert.equal(sent, false);
});
test('a confirmed response permits a deliberate second payment with a new key', async () => {
  const api = client(), keys = [];
  for (let i = 0; i < 2; i++) await api.financialRequest('token', path, body, async key => { keys.push(key); return 'receipt'; });
  assert.notEqual(keys[0], keys[1]);
});
test('only an explicit not-committed ledger error clears an uncertain key', async () => {
  for (const status of [200, 401, 403, 409, 500, 503]) {
    const storage = new Map(), api = client(storage);
    await assert.rejects(api.financialRequest('token', path, body, async () => { throw { status, data: {} }; }));
    assert.equal(storage.size, 1);
  }
  const storage = new Map();
  await assert.rejects(client(storage).financialRequest('token', path, body, async () => {
    throw { status: 400, data: { code: 'NOT_COMMITTED' } };
  }));
  assert.equal(storage.size, 0);
});
test('a refreshed JWT for the same account preserves its pending operation', async () => {
  const jwt = expiry => `header.${Buffer.from(JSON.stringify({ id: 'same-user', exp: expiry })).toString('base64url')}.signature`;
  const storage = new Map(), keys = [];
  await assert.rejects(client(storage).financialRequest(jwt(1), path, body, async key => { keys.push(key); throw Error('timeout'); }));
  await client(storage).financialRequest(jwt(2), path, body, async key => { keys.push(key); return 'receipt'; });
  assert.equal(keys[0], keys[1]);
});
test('equivalent decimal formatting can recover the same pending request', async () => {
  const api = client(), keys = [];
  await assert.rejects(api.financialRequest('token', path, { ...body, amount: '20.00' }, async key => {
    keys.push(key); throw Error('timeout');
  }));
  await api.financialRequest('token', path, body, async key => { keys.push(key); return 'receipt'; });
  assert.equal(keys[0], keys[1]);
});
test('a newly validated mining entitlement clears only its own previous request', async () => {
  const storage = new Map(), api = client(storage);
  for (const route of ['/mining/start', '/wallet/send'])
    await assert.rejects(api.financialRequest('token', route, {}, async () => { throw Error('timeout'); }));
  await api.clearEligibleMiningRequest('token');
  assert.equal(storage.size, 1); assert.ok([...storage.keys()][0].endsWith('/wallet/send'));
});
