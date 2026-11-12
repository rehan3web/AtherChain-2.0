import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import vm from 'node:vm';

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); });
test('the actual API proxy forwards stable operation keys but never cookies', async () => {
  const upstream = http.createServer((req, res) => {
    req.resume();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      key: req.headers['idempotency-key'], authorization: req.headers.authorization,
      cookie: req.headers.cookie ?? null, path: req.url,
    }));
  });
  await listen(upstream);
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(new URL('../server/api-proxy.js', import.meta.url), 'utf8'), {
    module, URL, process: { env: { BACKEND_API_URL: `http://127.0.0.1:${upstream.address().port}` } },
    require: name => name === 'node:http' ? http : https,
  });
  const proxy = http.createServer((req, res) => module.exports.proxyApi(req, res, () => { res.writeHead(404); res.end(); }));
  await listen(proxy);
  try {
    const response = await fetch(`http://127.0.0.1:${proxy.address().port}/api/wallet/send`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json', 'Idempotency-Key': 'persistent-operation-key',
        Authorization: 'Bearer fixture-only', Cookie: 'fixture-only',
      }, body: JSON.stringify({ amount: 1 }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      key: 'persistent-operation-key', authorization: 'Bearer fixture-only', cookie: null, path: '/wallet/send',
    });
  } finally { await close(proxy); await close(upstream); }
});
