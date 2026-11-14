// Hermetic tests: actual web request code + actual backend controllers/services.
// No configured API, user database, wallet or external network is contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const backend = path.resolve(__dirname, '../../Backend');
const ts = require(require.resolve('typescript', { paths: [backend] }));
const { harness } = require(path.join(backend, 'scripts/ledger-fixtures.cjs'));
const src = path.resolve(__dirname, '../src');

function load(file, dependencies = {}, globals = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(src, file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    }).outputText;
    vm.runInNewContext(code, {
        exports, console, ...globals,
        require(name) {
            if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
            return dependencies[name];
        }
    });
    return exports;
}
const core = load('lib/financialRequests.ts');
function storage() {
    const data = new Map();
    return {
        data, getItem: key => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value),
        removeItem: key => data.delete(key)
    };
}
function locks() {
    const queues = new Map();
    return (name, action) => {
        const next = (queues.get(name) || Promise.resolve()).catch(() => {}).then(action);
        queues.set(name, next.catch(() => {}));
        return next;
    };
}
function client(store = storage(), withLock = locks()) {
    return core.createFinancialRequests({ storage: store, withLock, randomUUID: crypto.randomUUID });
}
const body = { recipient: 'receiver', amount: '10' };
const failure = (status, code) => Object.assign(new Error('fixture failure'), { response: { status, data: { code } } });

test('exact decimal normalization rejects exponent, zero, negative, overflow and excess precision', () => {
    assert.equal(core.normalizeAmount('001.23000000'), '1.23');
    assert.equal(core.normalizeAmount('0.00000001'), '0.00000001');
    assert.equal(core.normalizeAmount('999999999999.99999999'), '999999999999.99999999');
    for (const amount of ['1e-8', '0', '-1', '0.000000001', '1000000000000', 'NaN']) {
        assert.throws(() => core.normalizeAmount(amount));
    }
});

test('lost responses survive reload and reuse the exact key; changed details stay blocked', async () => {
    const store = storage(), first = client(store);
    let original;
    await assert.rejects(first.run('account', '/send', body, async key => {
        original = key;
        assert.equal(first.pending('account', '/send').key, key);
        throw new Error('lost response');
    }));
    const reloaded = client(store);
    await assert.rejects(reloaded.run('account', '/send', { ...body, amount: '11' }, async () => assert.fail('must not send')));
    await reloaded.run('account', '/send', { amount: '10.00000000', recipient: 'receiver' }, async key => {
        assert.equal(key, original);
        return { success: true };
    });
    assert.equal(reloaded.pending('account', '/send'), null);
});

test('only an explicit NOT_COMMITTED clears uncertainty', async () => {
    for (const [status, code] of [[401], [403], [400], [409, 'IDEMPOTENCY_CONFLICT'], [503], [400, 'INVALID_OPERATION_KEY']]) {
        const c = client();
        await assert.rejects(c.run('account', '/send', body, async () => { throw failure(status, code); }));
        assert.ok(c.pending('account', '/send'));
    }
    const c = client();
    await assert.rejects(c.run('account', '/send', body, async () => { throw failure(400, 'NOT_COMMITTED'); }));
    assert.equal(c.pending('account', '/send'), null);
});

test('double clicks share a request; a deliberate later payment gets a new key', async () => {
    const c = client(), keys = [];
    const send = async key => { keys.push(key); return { success: true }; };
    await Promise.all([c.run('account', '/send', body, send), c.run('account', '/send', body, send)]);
    assert.equal(keys.length, 1);
    await c.run('account', '/send', body, send);
    assert.equal(keys.length, 2);
    assert.notEqual(keys[0], keys[1]);
});

test('simultaneous tabs cannot send twice after the first tab clears pending', async () => {
    const store = storage(), lock = locks(), a = client(store, lock), b = client(store, lock);
    let count = 0;
    const send = async () => { count++; return { hash: 'receipt' }; };
    const results = await Promise.all([a.run('account', '/send', body, send), b.run('account', '/send', body, send)]);
    assert.equal(count, 1);
    assert.equal(results[1].hash, 'receipt');
});

test('account and operation scopes are isolated', async () => {
    const c = client();
    await assert.rejects(c.run('a', '/send', body, async () => { throw new Error('offline'); }));
    assert.equal(c.pending('b', '/send'), null);
    assert.equal(c.pending('a', '/swap'), null);
});

test('unavailable or corrupt storage fails closed before any payment', async () => {
    const store = storage();
    store.setItem = () => { throw new Error('storage blocked'); };
    await assert.rejects(client(store).run('a', '/send', body, async () => assert.fail('must not send')));
    const corrupt = storage();
    corrupt.data.set('ather_web_pending:a:/send', '{broken');
    await assert.rejects(client(corrupt).run('a', '/send', body, async () => assert.fail('must not send')));
});

function webFixture() {
    const h = harness(), store = storage(), lock = locks(), calls = [];
    const controllers = {
        '/wallet/send': h.load('src/controllers/wallet.ts').sendATH,
        '/swap/execute': h.load('src/controllers/swap.ts').executeSwap,
        '/mining/start': h.load('src/controllers/mining.ts').startMining,
        '/mining/claim-boost': h.load('src/controllers/mining.ts').claimBoost
    };
    const fixture = { h, store, calls, loseResponse: false, authFailure: false, invalidReceipt: false };
    const api = {
        async post(url, body, config) {
            calls.push({ url, body, config });
            if (fixture.authFailure) throw failure(401);
            const res = { code: 200, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
            await controllers[url]({
                user: { id: 'sender' }, body,
                headers: { 'idempotency-key': config.headers['Idempotency-Key'] }
            }, res);
            if (res.code >= 400) throw Object.assign(new Error(res.data.message), { response: { status: res.code, data: res.data } });
            if (fixture.loseResponse) { fixture.loseResponse = false; throw new Error('proxy lost response'); }
            return { data: fixture.invalidReceipt ? {} : res.data };
        }
    };
    const token = version => `header.${Buffer.from(JSON.stringify({ id: 'sender', iat: version })).toString('base64url')}.signature`;
    store.setItem('token', token(1));
    fixture.refreshToken = () => store.setItem('token', token(2));
    fixture.reload = () => load('services/financial.ts', {
        '@/lib/api': { default: api }, '@/lib/financialRequests': core
    }, {
        window: { localStorage: store }, localStorage: store,
        navigator: { locks: { request: lock } }, crypto: crypto.webcrypto,
        TextEncoder, atob: value => Buffer.from(value, 'base64').toString('binary')
    });
    fixture.web = fixture.reload();
    return fixture;
}

test('web send recovers a lost response after reload/token refresh with no second debit', async () => {
    const f = webFixture(); f.loseResponse = true;
    await assert.rejects(f.web.financialRequest('/wallet/send', { recipient: 'receiver', amount: '20.00000000' }));
    assert.equal(f.h.db.state.wallets.sender.balance_ath, '80.00000000');
    f.refreshToken();
    const web = f.reload(), pending = await web.getPendingFinancialRequest('/wallet/send');
    const result = await web.financialRequest('/wallet/send', pending.body);
    assert.equal(result.replayed, true);
    assert.equal(f.calls[0].config.headers['Idempotency-Key'], f.calls[1].config.headers['Idempotency-Key']);
    assert.equal(f.h.db.state.wallets.receiver.balance_ath, '27.00000000');
    assert.equal(await web.getPendingFinancialRequest('/wallet/send'), null);
});

test('swap uses the committed backend receipt despite unavailable history', async () => {
    const f = webFixture(); f.h.mongo.failAt = 1;
    const result = await f.web.financialRequest('/swap/execute', { amountAT: '10', fromToken: 'AT', toToken: 'ATH' });
    assert.equal(result.receipt.fromAmount, 10);
    assert.equal(result.receipt.toAmount, 20);
    assert.equal(result.status, 'completed');
    assert.equal(result.historyPending, true);
    assert.equal(f.calls[0].body.amountAT, '10');
    assert.equal(f.h.db.state.wallets.sender.balance_ath, '120.00000000');
});

for (const endpoint of ['/mining/start', '/mining/claim-boost']) {
    test(`${endpoint} replays the saved receipt rather than applying a second reward`, async () => {
        const f = webFixture(); f.loseResponse = true;
        await assert.rejects(f.web.financialRequest(endpoint, {}));
        const web = f.reload();
        const result = await web.financialRequest(endpoint, (await web.getPendingFinancialRequest(endpoint)).body);
        assert.equal(result.replayed, true);
        if (endpoint.endsWith('start')) assert.equal(f.h.db.state.users.sender.at_balance, '102.00000000');
        else assert.equal(f.h.db.state.users.sender.current_cycle_boosts, 1);
    });
}

test('web auth failures and invalid success responses keep the persisted key', async () => {
    const f = webFixture(); f.authFailure = true;
    await assert.rejects(f.web.financialRequest('/wallet/send', body));
    const key = (await f.web.getPendingFinancialRequest('/wallet/send')).key;
    f.authFailure = false; f.invalidReceipt = true;
    await assert.rejects(f.web.financialRequest('/wallet/send', body));
    assert.equal((await f.web.getPendingFinancialRequest('/wallet/send')).key, key);
    f.invalidReceipt = false;
    const recovered = await f.web.financialRequest('/wallet/send', body);
    assert.equal(recovered.replayed, true);
    assert.equal(f.h.db.state.wallets.sender.balance_ath, '90.00000000');
});

test('username display prefixes are normalized without changing email identifiers', () => {
    const { web } = webFixture();
    assert.equal(web.normalizeRecipient(' @receiver ', 'username'), 'receiver');
    assert.equal(web.normalizeRecipient(' receiver@example.test ', 'email'), 'receiver@example.test');
});
