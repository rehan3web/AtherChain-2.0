const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');

function load(file, deps) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, { exports, console: { log() {}, error() {} }, require(name) {
        assert.ok(name in deps, `Unexpected dependency ${name}`); return deps[name];
    } });
    return exports;
}
function fixture() {
    let now = 0, code = 210000, failEmail = false, failDB = false;
    const user = { id: 'recovery-owner', email: 'owner@test.example', twofa_enabled: true,
        otp_code: '123456', otp_expires_at: new Date(Date.now() + 60000), reset_token: '654321' };
    const values = new Map(), deadlines = new Map(), sent = [], updates = [], deleted = [];
    const read = key => {
        if (deadlines.has(key) && deadlines.get(key) <= now) { values.delete(key); deadlines.delete(key); }
        return values.get(key) ?? null;
    };
    const redis = {
        async incr(key) { const value = Number(read(key) || 0) + 1; values.set(key, String(value)); return value; },
        async expire(key, seconds) { deadlines.set(key, now + seconds * 1000); },
        async set(key, value, unit, duration, nx) {
            if (nx === 'NX' && read(key) !== null) return null;
            values.set(key, value); deadlines.set(key, now + duration * (unit === 'EX' ? 1000 : 1)); return 'OK';
        },
        async del(...keys) { keys.forEach(key => { deleted.push(key); values.delete(key); deadlines.delete(key); }); },
        async smembers() { return ['session-one', 'session-two']; },
        // Hermetic Redis equivalent of the small atomic compare/attempt/consume operation.
        async eval(script, count, key, digest, action) {
            assert.equal(count, 1); assert.match(script, /PTTL/); assert.match(script, /state.attempts >= 5/);
            const raw = read(key); if (!raw) return 0;
            const state = JSON.parse(raw);
            if (state.attempts >= 5) return -1;
            if (state.digest !== digest) {
                state.attempts++; values.set(key, JSON.stringify(state)); return state.attempts >= 5 ? -1 : 0;
            }
            if (action === 'consume') values.delete(key);
            return 1;
        },
    };
    const recovery = load('src/services/recoveryOtp.ts', {
        '../db/redis': redis, 'node:crypto': { ...crypto, randomInt: () => ++code },
    });
    const send = purpose => async (email, otp) => {
        if (failEmail) throw Error('Fixture email failure');
        sent.push({ purpose, email, otp });
    };
    const auth = load('src/controllers/auth.ts', {
        '../services/recoveryOtp': recovery,
        '../models/user': { UserModel: {
            findByEmail: async email => email === user.email ? user : null,
            findById: async id => id === user.id ? user : null,
        } },
        '../db/redis': redis, '../db/postgres': { query: async (sql, args) => {
            if (failDB) throw Error('Fixture DB failure');
            updates.push({ sql, args });
            if (sql.includes('twofa_enabled = FALSE')) user.twofa_enabled = false;
            return { rowCount: 1 };
        } },
        bcryptjs: { hash: async password => `hashed:${password}` },
        jsonwebtoken: {}, speakeasy: {}, uuid: {}, '../config/env': { env: {} },
        './referral': {}, '../models/fingerprint': {}, '../services/sessionRecovery': {},
        '../services/emailService': { emailService: {
            sendPasswordResetOTP: send('password'), send2FAResetOTP: send('twofa'),
        } },
    });
    const call = async (method, body) => {
        const result = { statusCode: 200, status(code) { this.statusCode = code; return this; },
            json(data) { this.data = data; return this; } };
        await auth[method]({ body }, result);
        return result;
    };
    return { call, user, values, sent, updates, deleted, recovery,
        advance(seconds) { now += seconds * 1000; },
        failEmail() { failEmail = true; }, failDB() { failDB = true; } };
}

test('password email OTP is hashed, purpose-bound and expires after ten minutes', async () => {
    const h = fixture();
    const sent = await h.call('forgotPassword', { email: ' OWNER@Test.Example ' });
    assert.equal(sent.statusCode, 200);
    assert.equal(h.sent.length, 1);
    const raw = h.values.get('recovery:password:recovery-owner');
    assert.ok(raw); assert.equal(raw.includes(h.sent[0].otp), false);
    assert.equal(h.updates.length, 0);
    assert.equal((await h.call('verifyResetOTP', { email: h.user.email, token: h.sent[0].otp })).statusCode, 200);
    h.advance(601);
    assert.equal((await h.call('verifyResetOTP', { email: h.user.email, token: h.sent[0].otp })).statusCode, 400);
});
test('password reset consumes its code once, revokes actual sessions and does not create a login', async () => {
    const h = fixture();
    await h.call('forgotPassword', { email: h.user.email });
    const body = { email: h.user.email, token: h.sent[0].otp, newPassword: 'new-fixture-password' };
    assert.equal((await h.call('verifyResetOTP', body)).statusCode, 200);
    const reset = await h.call('resetPassword', body);
    assert.equal(reset.statusCode, 200); assert.equal(reset.data.token, undefined);
    assert.equal(h.updates[0].args[0], 'hashed:new-fixture-password');
    for (const key of ['session:session-one', 'session:session-two', 'user_sessions:recovery-owner'])
        assert.ok(h.deleted.includes(key));
    assert.equal((await h.call('resetPassword', body)).statusCode, 400);
    assert.equal(h.updates.length, 1);
});
test('invalid email, weak passwords and invalid codes cannot change a password', async () => {
    const h = fixture();
    assert.equal((await h.call('forgotPassword', { email: 'bad' })).statusCode, 400);
    assert.equal((await h.call('forgotPassword', { email: 'missing@test.example' })).statusCode, 404);
    await h.call('forgotPassword', { email: h.user.email });
    for (const newPassword of [undefined, 'short', ' '.repeat(10), 'a'.repeat(129)])
        assert.equal((await h.call('resetPassword', { email: h.user.email, token: h.sent[0].otp, newPassword })).statusCode, 400);
    assert.equal((await h.call('resetPassword', { email: h.user.email, token: '111111', newPassword: 'valid-password' })).statusCode, 400);
    assert.equal(h.updates.length, 0);
});
test('2FA reset uses its own email OTP, not registration, suspicious-login or password reset codes', async () => {
    const h = fixture();
    await h.call('forgotPassword', { email: h.user.email });
    const start = await h.call('start2FARecovery', { email: h.user.email });
    assert.equal(start.data.userId, h.user.id); assert.ok(start.data.maskedEmail.includes('*'));
    const body = { userId: h.user.id, otp: h.user.otp_code };
    assert.equal((await h.call('verify2FARecovery', body)).statusCode, 400);
    body.otp = h.sent[0].otp;
    assert.equal((await h.call('verify2FARecovery', body)).statusCode, 400);
    body.otp = h.sent[1].otp;
    const result = await h.call('verify2FARecovery', body);
    assert.equal(result.statusCode, 200); assert.equal(result.data.token, undefined);
    assert.equal(h.user.twofa_enabled, false);
    assert.equal(h.user.otp_code, '123456');
    assert.equal(h.updates.length, 1);
    assert.equal(h.updates[0].sql.includes('otp_code'), false);
    assert.equal((await h.call('verify2FARecovery', body)).statusCode, 400);
});
test('five wrong attempts lock the code and resend replaces it only after the cooldown', async () => {
    const h = fixture();
    await h.call('forgotPassword', { email: h.user.email });
    const original = h.sent[0].otp;
    assert.equal((await h.call('forgotPassword', { email: h.user.email })).statusCode, 429);
    for (let attempt = 0; attempt < 5; attempt++)
        await h.call('verifyResetOTP', { email: h.user.email, token: '111111' });
    assert.equal((await h.call('verifyResetOTP', { email: h.user.email, token: original })).statusCode, 429);
    h.advance(61);
    await h.call('forgotPassword', { email: h.user.email });
    assert.equal((await h.call('verifyResetOTP', { email: h.user.email, token: original })).statusCode, 400);
    assert.equal((await h.call('verifyResetOTP', { email: h.user.email, token: h.sent[1].otp })).statusCode, 200);
});
test('resend has an hourly limit and email failure cannot leave a usable recovery code', async () => {
    const h = fixture();
    for (let request = 0; request < 5; request++) {
        assert.equal((await h.call('forgotPassword', { email: h.user.email })).statusCode, 200);
        h.advance(61);
    }
    assert.equal((await h.call('forgotPassword', { email: h.user.email })).statusCode, 429);
    const failure = fixture(); failure.failEmail();
    assert.equal((await failure.call('forgotPassword', { email: failure.user.email })).statusCode, 500);
    assert.equal(failure.values.has('recovery:password:recovery-owner'), false);
});
test('2FA recovery supports the existing userId contract and refuses accounts without 2FA', async () => {
    const h = fixture();
    assert.equal((await h.call('start2FARecovery', { userId: h.user.id })).statusCode, 200);
    h.user.twofa_enabled = false;
    assert.equal((await h.call('start2FARecovery', { email: h.user.email })).statusCode, 400);
});
test('database failure is explicit and never returns a success result or an authenticated session', async () => {
    const h = fixture();
    await h.call('start2FARecovery', { email: h.user.email });
    h.failDB();
    const result = await h.call('verify2FARecovery', { userId: h.user.id, otp: h.sent[0].otp });
    assert.equal(result.statusCode, 500); assert.equal(result.data.token, undefined);
    assert.equal(h.user.twofa_enabled, true);
});
