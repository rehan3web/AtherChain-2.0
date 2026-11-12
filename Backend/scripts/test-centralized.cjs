const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { harness, root } = require('./ledger-fixtures.cjs');
const key = 'centralized-test-key-0001';

test('startup validation does not require blockchain credentials', () => {
    const source = fs.readFileSync(path.join(root, 'src/config/env.ts'), 'utf8');
    const exports = {};
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } }).outputText, {
        exports, require: name => name === 'dotenv' ? { config() {} } : require('zod'),
        console, process: { env: {
            POSTGRES_URL: 'postgres://localhost/test', MONGO_URI: 'mongodb://localhost/test',
            REDIS_URL: 'redis://localhost:6379', JWT_SECRET: 'fixture-jwt-only',
            ENCRYPTION_SECRET: 'fixture-encryption-only', ADMIN_EMAIL: 'admin@example.test',
            ADMIN_PASSWORD_HASH: 'fixture-hash', EMAIL_USER: 'mail@example.test',
            EMAIL_PASSWORD: 'fixture-email-only', VAPID_PUBLIC_KEY: 'fixture-public', VAPID_PRIVATE_KEY: 'fixture-push-only',
        }, exit: () => assert.fail('Centralized environment rejected') },
    });
    for (const name of ['RPC_URL', 'CHAIN_ID', 'ATH_ADMIN_PRIVATE_KEYS', 'SWAP_CONTRACT_ADDRESS', 'SWAP_BACKEND_SIGNER_KEY', 'WATH_TOKEN_ADDRESS'])
        assert.equal(name in exports.env, false);
});
test('wallet identifiers have no signing secrets and remain unique', async () => {
    const { WalletService } = harness().load('src/services/wallet.ts');
    const addresses = new Set();
    for (let i = 0; i < 100; i++) {
        const wallet = await WalletService.createWallet();
        assert.deepEqual(Object.keys(wallet), ['address']);
        assert.match(wallet.address, /^ATH_[0-9A-F]{40}$/);
        addresses.add(wallet.address);
    }
    assert.equal(addresses.size, 100);
    assert.equal('getTokenBalance' in WalletService, false);
});
test('wallet balances come from the internal database', async () => {
    const h = harness();
    assert.equal(await h.load('src/services/wallet.ts').WalletService.getBalance('ATH_SENDER'), '100.00000000');
});
test('external asset symbols cannot reach internal transfer logic', async () => {
    const h = harness();
    for (const symbol of ['WATH', 'BTC', 'ETH'])
        await assert.rejects(h.load('src/services/wallet.ts').WalletService.transfer('sender', 'receiver', '1', 'send', symbol, key), /Only internal ATH/);
    assert.equal(h.db.calls.length, 0);
});
test('missing and malformed operation keys are rejected explicitly', () => {
    const { requestKey } = harness().load('src/services/ledgerOperations.ts');
    for (const value of [undefined, '', ['bad'], 'short', 'x'.repeat(129)])
        assert.throws(() => requestKey({ headers: { 'idempotency-key': value } }), /Idempotency-Key/);
    assert.equal(requestKey({ headers: { 'idempotency-key': key } }), key);
});
test('removed swap pairs are rejected by the actual controller', async () => {
    const h = harness(), controller = h.load('src/controllers/swap.ts');
    for (const [fromToken, toToken] of [['ATH', 'WATH'], ['WATH', 'ATH'], ['ATH', 'AT']]) {
        const response = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json() {} };
        await controller.executeSwap({ user: { id: 'sender' }, body: { amountAT: 10, fromToken, toToken } }, response);
        assert.equal(response.statusCode, 400);
    }
    assert.equal(h.db.calls.length, 0);
});
test('invalid amounts and rates never debit balances', async () => {
    for (const amount of [0, -1, 'Infinity', 'NaN', true, [], null, '0.000000001', '9999999999999']) {
        const h = harness();
        await assert.rejects(h.load('src/services/swapService.ts').SwapService.swapATtoATH('sender', amount, key));
        assert.equal(h.db.state.users.sender.at_balance, '100.00000000');
    }
    const h = harness(); h.db.state.settings.swap.rate = 'invalid';
    await assert.rejects(h.load('src/services/swapService.ts').SwapService.swapATtoATH('sender', 10, key), /Invalid swap rate/);
});
test('disabled settings, KYC and account flags remain enforced', async () => {
    for (const change of [{ kyc_status: 'pending' }, { is_blocked: true }, { swap_paused: true }, { is_swap_enabled: false }]) {
        const h = harness(); Object.assign(h.db.state.users.sender, change);
        await assert.rejects(h.load('src/services/swapService.ts').SwapService.swapATtoATH('sender', 10, key), error => error.status === 403);
    }
    const h = harness(); h.db.state.settings.swap.active = false;
    await assert.rejects(h.load('src/services/swapService.ts').SwapService.swapATtoATH('sender', 10, key), error => error.status === 400);
});
test('the ledger does not reintroduce contracts or destructive schema changes', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
    assert.equal('ethers' in pkg.dependencies, false);
    const files = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name); return entry.isDirectory() ? files(file) : [file];
    });
    assert.equal(files(path.join(root, 'src')).some(file => file.endsWith('.sol')), false);
    for (const directory of ['src/artifacts', 'src/WATH'])
        assert.equal(fs.existsSync(path.join(root, directory)) ? files(path.join(root, directory)).length : 0, 0);
    const schema = fs.readFileSync(path.join(root, 'src/services/ledgerOperations.ts'), 'utf8');
    assert.doesNotMatch(schema, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
    assert.match(schema, /ON DELETE CASCADE/);
});
