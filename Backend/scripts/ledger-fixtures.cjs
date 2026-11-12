// Hermetic fixtures: real service/controller source, no sockets or real databases.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const clone = value => structuredClone(value);
const units = value => {
    const [whole, fraction = ''] = String(value).split('.');
    return BigInt(whole) * 100000000n + BigInt(fraction.padEnd(8, '0'));
};
const decimal = value => `${value / 100000000n}.${(value % 100000000n).toString().padStart(8, '0')}`;
const rows = values => ({ rows: values, rowCount: values.length });

function harness() {
    const db = {
        state: {
            users: Object.fromEntries(['sender', 'receiver'].map(id => [id, {
                id, email: `${id}@example.test`, username: id, at_balance: '100.00000000',
                is_blocked: false, is_transfer_enabled: true, transfer_paused: false,
                kyc_status: 'approved', is_swap_enabled: true, swap_paused: false,
                is_mining_enabled: true, mining_paused: false, last_mined_at: null,
                current_cycle_boosts: 0, next_swap_at: null, referred_by: null,
            }])),
            wallets: { sender: { user_id: 'sender', address: 'ATH_SENDER', balance_ath: '100.00000000' },
                receiver: { user_id: 'receiver', address: 'ATH_RECEIVER', balance_ath: '7.00000000' } },
            settings: { swap: { active: true, rate: 2, cooldown_enabled: true, cooldown_hours: 24 },
                transfer: { active: true }, mining: { active: true, daily_reward: '2' },
                boost_reward_amount: '0.1', boost_enabled: 'true', daily_boost_max: '3', mining_cycle_hours: '24' },
            operations: [],
        },
        calls: [], released: 0, discarded: 0, failInsert: false, failCredit: false,
        failCommitAck: false, failRollback: false, failReceiptRead: false,
    };
    let queue = Promise.resolve();
    async function lock() {
        const previous = queue;
        let unlock;
        queue = new Promise(resolve => { unlock = resolve; });
        await previous;
        return unlock;
    }
    let clientNumber = 0;
    function client() {
        let stage, unlock;
        const id = ++clientNumber;
        return {
            release(broken) { db.released++; if (broken) db.discarded++; if (unlock) { unlock(); unlock = null; } },
            async query(raw, values = []) {
                const sql = raw.replace(/\s+/g, ' ').trim();
                db.calls.push({ client: id, sql, values: clone(values) });
                if (sql === 'BEGIN') return rows([]);
                if (sql.includes('SELECT id FROM users WHERE id = $1 FOR UPDATE') || sql.startsWith('SELECT id, events FROM ledger_operations')) {
                    unlock = await lock(); stage = clone(db.state);
                }
                let state = stage ?? db.state;
                if (sql === 'COMMIT' || sql === 'ROLLBACK') {
                    if (sql === 'ROLLBACK' && db.failRollback) throw Error('Rollback connection failed');
                    if (sql === 'COMMIT' && stage) db.state = stage;
                    stage = null;
                    if (unlock) { unlock(); unlock = null; }
                    if (sql === 'COMMIT' && db.failCommitAck) { db.failCommitAck = false; throw Error('Lost commit acknowledgment'); }
                    return rows([]);
                }
                if (sql.startsWith('SELECT id FROM users WHERE id =')) return rows(state.users[values[0]] ? [{ id: values[0] }] : []);
                if (sql.startsWith('SELECT fingerprint, result')) {
                    if (db.failReceiptRead) throw Error('Receipt lookup unavailable');
                    return rows(state.operations.filter(op =>
                        op.user_id === values[0] && op.kind === values[1] && op.request_key === values[2]).map(clone));
                }
                if (sql.startsWith('INSERT INTO ledger_operations')) {
                    if (db.failInsert) throw Error('Injected durable-record failure');
                    state.operations.push({ id: values[0], user_id: values[1], kind: values[2], request_key: values[3],
                        fingerprint: values[4], result: JSON.parse(values[5]), events: JSON.parse(values[6]),
                        delivered_at: values[7] ? 'delivered' : null, attempts: 0, next_attempt_at: 0 });
                    return rows([]);
                }
                if (sql.startsWith('SELECT id, events FROM ledger_operations')) return rows(state.operations.filter(op =>
                    !op.delivered_at && op.next_attempt_at <= Date.now()).slice(0, 1).map(clone));
                if (sql.startsWith('SELECT id FROM users WHERE id=ANY')) return rows(values[0].filter(id => state.users[id]).map(id => ({ id })));
                if (sql.startsWith('UPDATE ledger_operations SET delivered_at')) {
                    const op = state.operations.find(op => op.id === values[0]);
                    op.delivered_at = 'delivered'; op.events = []; op.attempts++; return rows([]);
                }
                if (sql.startsWith('UPDATE ledger_operations SET attempts')) {
                    const op = state.operations.find(op => op.id === values[0]);
                    if (op) { op.attempts++; op.next_attempt_at = Date.now() + 10000; } return rows([]);
                }
                if (sql.includes('FROM system_settings')) {
                    if (sql.includes('key=ANY')) return rows(values[0].filter(key => key in state.settings).map(key => ({ key, value: clone(state.settings[key]) })));
                    const key = /key='([^']+)'/.exec(sql)?.[1] ?? values[0];
                    return rows(key in state.settings ? [{ value: clone(state.settings[key]) }] : []);
                }
                if (sql.includes('JOIN wallets')) {
                    const user = Object.values(state.users).find(user => state.wallets[user.id] &&
                        [user.id, user.email, user.username, state.wallets[user.id].address].includes(values[0]));
                    return rows(user ? [{ id: user.id, address: state.wallets[user.id].address }] : []);
                }
                if (sql.includes('FROM users WHERE id=$1')) return rows(state.users[values[0]] ? [clone(state.users[values[0]])] : []);
                if (sql.startsWith('SELECT user_id,address FROM wallets')) {
                    assert.match(sql, /ORDER BY user_id FOR UPDATE/);
                    return rows(values[0].filter(id => state.wallets[id]).sort().map(id => clone(state.wallets[id])));
                }
                if (sql.startsWith('UPDATE users SET at_balance=at_balance-$1')) {
                    const user = state.users[values[1]];
                    if (!user || units(user.at_balance) < units(values[0])) return rows([]);
                    user.at_balance = decimal(units(user.at_balance) - units(values[0])); return rows([{ at_balance: user.at_balance }]);
                }
                if (sql.startsWith('UPDATE users SET next_swap_at')) {
                    state.users[values[0]].next_swap_at = values[1] ? new Date(Date.now() + values[2] * 3600000).toISOString() : null;
                    return rows([{ id: values[0] }]);
                }
                if (sql.startsWith('UPDATE users SET current_cycle_boosts')) {
                    const user = state.users[values[0]];
                    if (user.current_cycle_boosts >= values[1]) return rows([]);
                    user.current_cycle_boosts++; return rows([{ current_cycle_boosts: user.current_cycle_boosts }]);
                }
                if (sql.startsWith('UPDATE users SET at_balance=at_balance+$1')) {
                    const user = state.users[values[1]];
                    if (user.last_mined_at && Date.parse(user.last_mined_at) > Date.now() - values[2] * 3600000) return rows([]);
                    user.at_balance = decimal(units(user.at_balance) + units(values[0]));
                    user.last_mined_at = new Date().toISOString(); user.current_cycle_boosts = 0;
                    return rows([{ at_balance: user.at_balance }]);
                }
                if (sql.startsWith('UPDATE wallets SET balance_ath=')) {
                    const wallet = state.wallets[values[1]];
                    const debit = sql.includes('balance_ath-$1');
                    if (!wallet || (!debit && db.failCredit)) return rows([]);
                    if (debit && units(wallet.balance_ath) < units(values[0])) return rows([]);
                    wallet.balance_ath = decimal(units(wallet.balance_ath) + (debit ? -1n : 1n) * units(values[0]));
                    return rows([{ balance_ath: wallet.balance_ath }]);
                }
                if (sql.startsWith('SELECT balance_ath FROM wallets')) {
                    const wallet = Object.values(state.wallets).find(wallet => wallet.address === values[0]);
                    return rows(wallet ? [{ balance_ath: wallet.balance_ath }] : []);
                }
                throw Error(`Unexpected fixture SQL: ${sql}`);
            },
        };
    }
    const pool = {
        connect: async () => client(),
        query: async (...args) => { const c = client(); try { return await c.query(...args); } finally { c.release(); } },
    };
    const mongo = { transactions: new Map(), mining: new Map(), calls: 0, failAt: 0, connected: true };
    const model = collection => ({ updateOne: async (filter, update) => {
        mongo.calls++;
        if (mongo.failAt === mongo.calls) throw Error('Injected MongoDB failure');
        if (!mongo[collection].has(filter._id)) mongo[collection].set(filter._id, clone(update.$setOnInsert));
        return { acknowledged: true };
    } });
    let objectId = 0;
    const mongoose = {
        Types: { ObjectId: class { constructor() { this.id = (++objectId).toString(16).padStart(24, '0'); } toHexString() { return this.id; } } },
        connection: { get readyState() { return mongo.connected ? 1 : 0; } },
    };
    const overrides = {
        [path.join(root, 'src/db/postgres.ts')]: { __esModule: true, default: pool, query: pool.query },
        [path.join(root, 'src/models/Transaction.ts')]: model('transactions'),
        [path.join(root, 'src/models/MiningLog.ts')]: model('mining'),
        [path.join(root, 'src/models/user.ts')]: { UserModel: { findById: async id => clone(db.state.users[id]) } },
        [path.join(root, 'src/models/settings.ts')]: { SettingsModel: { get: async key => clone(db.state.settings[key]) } },
        [path.join(root, 'src/services/cache.ts')]: { cache: { get: async () => null, set: async () => {} } },
        [path.join(root, 'src/controllers/referral.ts')]: { ReferralController: { applyReward: async () => {} } },
    };
    const cache = new Map();
    function load(relative) {
        const absolute = path.resolve(root, relative);
        if (absolute in overrides) return overrides[absolute];
        if (cache.has(absolute)) return cache.get(absolute);
        const exports = {};
        cache.set(absolute, exports);
        const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
        } }).outputText;
        vm.runInNewContext(code, {
            exports, console: { log() {}, error() {} }, Date, setInterval, process,
            require(name) {
                if (name === 'mongoose') return mongoose;
                if (name === 'crypto') return crypto;
                if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(absolute), name + '.ts')));
                throw Error(`Unexpected runtime dependency: ${name}`);
            },
        });
        return exports;
    }
    return { db, mongo, load, retryNow() { db.state.operations.forEach(op => { op.next_attempt_at = 0; }); } };
}
module.exports = { harness, root };
