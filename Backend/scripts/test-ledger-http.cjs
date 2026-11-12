const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { harness } = require('./ledger-fixtures.cjs');
const key = 'http-fixture-operation-key';

async function serverFixture(t) {
    const h = harness();
    const wallet = h.load('src/controllers/wallet.ts');
    const swap = h.load('src/controllers/swap.ts');
    const mining = h.load('src/controllers/mining.ts');
    const routes = {
        '/wallet/send': wallet.sendATH, '/swap/execute': swap.executeSwap,
        '/mining/start': mining.startMining, '/mining/status': mining.getMiningStatus,
        '/mining/validate': mining.validateMining, '/mining/claim-boost': mining.claimBoost,
    };
    // Separate, loopback-only fixture server. Production auth is never changed.
    const server = http.createServer(async (req, res) => {
        if (req.headers.authorization !== 'Bearer fixture-session') { res.writeHead(401); res.end(); return; }
        const buffers = [];
        for await (const chunk of req) buffers.push(chunk);
        req.body = buffers.length ? JSON.parse(Buffer.concat(buffers).toString()) : {};
        req.user = { id: 'sender' };
        res.status = code => { res.statusCode = code; return res; };
        res.json = value => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
        await routes[req.url](req, res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    return {
        ...h,
        async request(path, body, operationKey) {
            const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
                method: body === undefined ? 'GET' : 'POST',
                headers: { Authorization: 'Bearer fixture-session', 'Content-Type': 'application/json',
                    ...(operationKey ? { 'Idempotency-Key': operationKey } : {}) },
                body: body === undefined ? undefined : JSON.stringify(body),
            });
            return { status: response.status, body: await response.json() };
        },
    };
}

test('HTTP send rejects missing keys and safely recovers a repeated payment', async t => {
    const h = await serverFixture(t), body = { recipient: 'receiver', amount: 20 };
    const rejected = await h.request('/wallet/send', body);
    assert.equal(rejected.status, 400); assert.equal(rejected.body.code, 'INVALID_OPERATION_KEY');
    assert.equal(h.db.state.wallets.sender.balance_ath, '100.00000000');
    const first = await h.request('/wallet/send', body, key);
    const retry = await h.request('/wallet/send', body, key);
    assert.equal(first.status, 200); assert.equal(retry.status, 200);
    assert.equal(first.body.hash, retry.body.hash); assert.equal(retry.body.replayed, true);
    assert.equal(h.db.state.wallets.sender.balance_ath, '80.00000000');
    assert.equal(h.db.state.wallets.receiver.balance_ath, '27.00000000');
});
test('HTTP swap succeeds during MongoDB outage and replays before cooldown checks', async t => {
    const h = await serverFixture(t); h.mongo.connected = false;
    const body = { amountAT: 10, fromToken: 'AT', toToken: 'ATH' };
    const first = await h.request('/swap/execute', body, key);
    assert.equal(first.status, 200); assert.equal(first.body.historyPending, true);
    assert.equal(first.body.receipt.toAmount, 20);
    const retry = await h.request('/swap/execute', body, key);
    assert.equal(retry.status, 200); assert.equal(retry.body.hash, first.body.hash);
    const next = await h.request('/swap/execute', body, 'http-different-operation-key');
    assert.equal(next.status, 429); assert.equal(next.body.code, 'NOT_COMMITTED');
    assert.equal(h.db.state.users.sender.at_balance, '90.00000000');
});
test('HTTP mining and boost receipts preserve the app contract without duplicate rewards', async t => {
    const h = await serverFixture(t);
    assert.equal((await h.request('/mining/validate', {})).status, 200);
    const first = await h.request('/mining/start', {}, key);
    assert.equal(first.status, 200); assert.equal(first.body.reward, 2); assert.equal(first.body.newBalance, 102);
    assert.equal('referral' in first.body, false);
    assert.equal((await h.request('/mining/start', {}, key)).body.replayed, true);
    const status = await h.request('/mining/status');
    assert.equal(status.body.canMine, false); assert.ok(status.body.timeLeft > 0);
    const boost = await h.request('/mining/claim-boost', {}, key);
    assert.equal(boost.status, 200); assert.equal(boost.body.currentCycleBoosts, 1);
    assert.equal((await h.request('/mining/claim-boost', {}, key)).body.currentCycleBoosts, 1);
    assert.equal(h.db.state.users.sender.at_balance, '102.00000000');
});
