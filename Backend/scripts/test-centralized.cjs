const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function load(relative, dependencies, globals = {}) {
    const exports = {};
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    } }).outputText;
    vm.runInNewContext(compiled, {
        exports, console: { log() {}, error() {} },
        require(name) {
            assert.ok(name in dependencies, `Unexpected runtime dependency: ${name}`);
            return dependencies[name];
        },
        ...globals,
    });
    return exports;
}

test('startup validation needs no chain credentials but retains account security settings', () => {
    const environment = {
        POSTGRES_URL: 'postgres://localhost/test', MONGO_URI: 'mongodb://localhost/test',
        REDIS_URL: 'redis://localhost:6379', JWT_SECRET: 'fixture-jwt-only',
        ENCRYPTION_SECRET: 'fixture-encryption-only', ADMIN_EMAIL: 'admin@example.test',
        ADMIN_PASSWORD_HASH: 'fixture-hash', EMAIL_USER: 'mail@example.test',
        EMAIL_PASSWORD: 'fixture-email-only', VAPID_PUBLIC_KEY: 'fixture-public',
        VAPID_PRIVATE_KEY: 'fixture-push-only',
    };
    const { env } = load('src/config/env.ts', { dotenv: { config() {} }, zod: require('zod') }, {
        process: { env: environment, exit: () => assert.fail('Required centralized settings were rejected') },
    });
    assert.equal(env.JWT_SECRET, environment.JWT_SECRET);
    for (const key of ['RPC_URL', 'CHAIN_ID', 'ATH_ADMIN_PRIVATE_KEYS', 'SWAP_CONTRACT_ADDRESS', 'SWAP_BACKEND_SIGNER_KEY', 'WATH_TOKEN_ADDRESS'])
        assert.equal(key in env, false);
});

test('wallet creation produces only unique internal ledger identifiers', async () => {
    const { WalletService } = load('src/services/wallet.ts', {
        '../db/postgres': { query() {} }, uuid: { v4() {} }, crypto: require('node:crypto'),
    });
    const addresses = new Set();
    for (let i = 0; i < 100; i++) {
        const wallet = await WalletService.createWallet();
        assert.deepEqual(Object.keys(wallet), ['address']);
        assert.match(wallet.address, /^ATH_[0-9A-F]{40}$/);
        assert.equal(WalletService.isAddress(wallet.address), true);
        addresses.add(wallet.address);
    }
    assert.equal(addresses.size, 100);
    assert.equal('getTokenBalance' in WalletService, false);
});

test('wallet balances come directly from the account database', async () => {
    const { WalletService } = load('src/services/wallet.ts', {
        '../db/postgres': { query: async (sql, values) => {
            assert.match(sql, /SELECT balance_ath FROM wallets/);
            assert.equal(values[0], 'ATH_ACCOUNT');
            return { rows: [{ balance_ath: '72.50' }] };
        } }, uuid: {}, crypto: require('node:crypto'),
    });
    assert.equal(await WalletService.getBalance('ATH_ACCOUNT'), '72.50');
});

test('internal transfers cannot accept removed or external asset symbols', async () => {
    const { WalletService } = load('src/services/wallet.ts', {
        '../db/postgres': { query() {} }, uuid: {}, crypto: require('node:crypto'),
    });
    for (const symbol of ['WATH', 'BTC', 'ETH'])
        await assert.rejects(WalletService.transfer('sender', 'receiver', '1', 'send', symbol), /Only internal ATH/);
});

function swapService(funded) {
    const statements = [];
    let released = false;
    const client = {
        query: async (sql, values) => {
            statements.push({ sql, values });
            if (sql.includes('UPDATE users')) return { rows: funded ? [{ at_balance: 80 }] : [] };
            return { rows: [], rowCount: 1 };
        },
        release: () => { released = true; },
    };
    const { SwapService } = load('src/services/swapService.ts', {
        '../db/postgres': { connect: async () => client },
    });
    return { service: SwapService, statements, released: () => released };
}
test('AT to ATH conversion debits and credits within one database transaction', async () => {
    const app = swapService(true);
    assert.equal(await app.service.swapATtoATH('user', 20, 2), true);
    assert.equal(app.statements[0].sql, 'BEGIN');
    assert.match(app.statements[1].sql, /UPDATE users/);
    assert.equal(app.statements[1].values[0], 20);
    assert.match(app.statements[2].sql, /UPDATE wallets/);
    assert.equal(app.statements[2].values[0], 40);
    assert.equal(app.statements[3].sql, 'COMMIT');
    assert.equal(app.released(), true);
    for (const name of ['swapFixed', 'getWATHBalance', 'getNonce', 'isGlobalSwapEnabled'])
        assert.equal(name in app.service, false);
});
test('insufficient AT rolls back without crediting the wallet', async () => {
    const app = swapService(false);
    await assert.rejects(app.service.swapATtoATH('user', 20, 2), /Insufficient AT/);
    assert.equal(app.statements.at(-1).sql, 'ROLLBACK');
    assert.equal(app.statements.some(item => item.sql.includes('UPDATE wallets')), false);
    assert.equal(app.released(), true);
});

function swapController(options = {}) {
    const executions = [], history = [], unlocked = [];
    let userReads = 0;
    const settings = { active: true, rate: 2, ...options.settings };
    const user = { kyc_status: 'approved', at_balance: '100', ...options.user };
    const module = load('src/controllers/swap.ts', {
        '../models/Transaction': { create: async record => { history.push(record); return { _id: 'database-reference' }; } },
        '../models/settings': { SettingsModel: { get: async () => settings } },
        '../models/user': { UserModel: { findById: async () => { userReads++; return user; } } },
        '../services/swapService': { SwapService: { swapATtoATH: async (...args) => {
            if (options.fail) throw new Error('Database rejected conversion');
            executions.push(args);
        } } },
        '../services/cache': { cache: {
            get: async key => key === 'swap_settings' ? settings : options.cachedCooldown ?? null,
            set: async () => {},
        } },
        '../db/redis': { set: async () => options.locked ? null : 'OK', del: async key => unlocked.push(key) },
        uuid: { v4: () => 'test-reference' },
    });
    return {
        executions, history, unlocked, userReads: () => userReads,
        async execute(body) {
            const response = {
                statusCode: 200, body: null,
                status(code) { this.statusCode = code; return this; },
                json(value) { this.body = value; return this; },
            };
            await module.executeSwap({ user: { id: 'account' }, body }, response);
            return response;
        },
    };
}
test('only AT to ATH is accepted; every removed pair is rejected before account reads', async () => {
    for (const [fromToken, toToken] of [['ATH', 'WATH'], ['WATH', 'ATH'], ['ATH', 'AT'], ['AT', 'BTC']]) {
        const app = swapController();
        const response = await app.execute({ amountAT: 10, fromToken, toToken });
        assert.equal(response.statusCode, 400);
        assert.equal(app.userReads(), 0);
        assert.equal(app.executions.length, 0); assert.equal(app.history.length, 0);
        assert.equal(app.unlocked.length, 1);
    }
});
test('successful swaps retain server history, amount and rate contracts', async () => {
    const app = swapController();
    const response = await app.execute({ amountAT: 10 });
    assert.equal(response.statusCode, 200); assert.equal(response.body.success, true);
    assert.equal(response.body.txId, 'database-reference');
    assert.equal(app.executions[0][1], 10); assert.equal(app.executions[0][2], 2);
    assert.equal(app.history[0].metadata.toAmount, 20);
    assert.equal(app.history[0].status, 'completed');
});
test('invalid amounts cannot mutate balances or history', async () => {
    for (const amountAT of [0, -1, 'Infinity', 'not-a-number', true, [], null]) {
        const app = swapController();
        assert.equal((await app.execute({ amountAT })).statusCode, 400);
        assert.equal(app.executions.length, 0); assert.equal(app.history.length, 0);
    }
});
test('disabled swap settings and invalid rates cannot execute a conversion', async () => {
    for (const [settings, status] of [[{ active: false }, 400], [{ rate: -1 }, 503], [{ rate: 'invalid' }, 503]]) {
        const app = swapController({ settings });
        assert.equal((await app.execute({ amountAT: 10 })).statusCode, status);
        assert.equal(app.executions.length, 0);
    }
});
test('KYC and account restrictions remain enforced', async () => {
    for (const user of [{ kyc_status: 'pending' }, { swap_paused: true }, { is_swap_enabled: false }]) {
        const app = swapController({ user });
        assert.equal((await app.execute({ amountAT: 10 })).statusCode, 403);
        assert.equal(app.executions.length, 0);
    }
});
test('cached and database cooldowns remain enforced', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    for (const options of [{ cachedCooldown: future }, { user: { next_swap_at: future } }]) {
        const app = swapController(options);
        assert.equal((await app.execute({ amountAT: 10 })).statusCode, 429);
        assert.equal(app.executions.length, 0);
    }
});
test('a failed conversion never records a successful swap', async () => {
    const app = swapController({ fail: true });
    assert.equal((await app.execute({ amountAT: 10 })).statusCode, 500);
    assert.equal(app.history.length, 0); assert.equal(app.unlocked.length, 1);
});
test('concurrent attempts do not release another request lock', async () => {
    const app = swapController({ locked: true });
    assert.equal((await app.execute({ amountAT: 10 })).statusCode, 429);
    assert.equal(app.unlocked.length, 0); assert.equal(app.userReads(), 0);
});

test('wallet router exposes only internal account balance, lookup and send routes', () => {
    const routes = [];
    const router = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (path) => routes.push([method, path])]));
    load('src/routes/wallet.ts', {
        express: { Router: () => router }, '../controllers/wallet': {},
        '../middlewares/auth': { auth() {} },
    });
    assert.deepEqual(routes, [['get', '/stats'], ['post', '/send'], ['post', '/lookup']]);
});
test('Solidity, compiled artifacts, chain settings and ethers dependency are absent', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
    assert.equal('ethers' in pkg.dependencies, false);
    function files(directory) {
        return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
            const full = path.join(directory, entry.name);
            return entry.isDirectory() ? files(full) : [full];
        });
    }
    assert.equal(files(path.join(root, 'src')).some(file => file.endsWith('.sol')), false);
    for (const directory of ['src/artifacts', 'src/WATH'])
        assert.equal(fs.existsSync(path.join(root, directory)) ? files(path.join(root, directory)).length : 0, 0);
    const schema = fs.readFileSync(path.join(root, 'src/db/setup_postgres.ts'), 'utf8');
    assert.equal(/wallet_vault|encrypted_private_key|encrypted_mnemonic|DROP TABLE|DROP COLUMN/i.test(schema), false);
});
