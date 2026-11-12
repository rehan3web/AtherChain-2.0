const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const jwt = require('jsonwebtoken');
const secret = 'isolated-auth-test-key-not-production';
function load(file, deps) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(code, { exports, Buffer, console: { log() {}, error() {} },
        require(name) { assert.ok(name in deps, `Unexpected dependency ${name}`); return deps[name]; } });
    return exports;
}
function harness() {
    const user = { id: 'owner', username: 'owner', role: 'user', is_blocked: false,
        twofa_enabled: true, twofa_secret: 'fixture', otp_code: '123456',
        otp_expires_at: new Date(Date.now() + 60000).toISOString(), is_email_verified: false,
        passkey_credentials: [{ id: 'credential', publicKey: Buffer.from('test').toString('base64'), counter: 0 }] };
    const sessions = new Map(['one', 'two'].map(id => [id, {
        device: id, loginTime: new Date().toISOString(), token: 'private-session-credential',
    }]));
    const members = new Set(['one', 'two']);
    const queries = [], deleted = [];
    let validOTP = true;
    const redis = {
        smembers: async key => key === 'user_sessions:owner' ? [...members] : [],
        hgetall: async key => sessions.get(key.slice(8)) || {},
        srem: async (_key, id) => members.delete(id),
        sismember: async (key, id) => key === 'user_sessions:owner' && members.has(id) ? 1 : 0,
        del: async key => { deleted.push(key); sessions.delete(key.slice(8)); },
        hmset: async (key, data) => sessions.set(key.slice(8), data), sadd: async (_key, id) => members.add(id),
        expire: async () => 1, exists: async key => sessions.has(key.slice(8)) ? 1 : 0,
        hset: async () => {}, get: async () => 'fixture-challenge',
    };
    const postgres = { query: async (sql, values) => {
        queries.push(sql);
        return { rows: [user], rowCount: 1 };
    } };
    const common = { jsonwebtoken: jwt, '../config/env': { env: { JWT_SECRET: secret, RP_ID: 'localhost' } },
        '../db/redis': redis, '../db/postgres': postgres };
    const recovery = load('src/services/sessionRecovery.ts', common);
    const dependencies = { ...common, '../services/sessionRecovery': recovery };
    const controller = load('src/controllers/sessionController.ts', dependencies).SessionController;
    const middleware = load('src/middlewares/auth.ts', dependencies).auth;
    const auth = load('src/controllers/auth.ts', { ...dependencies, bcryptjs: {}, uuid: { v4: () => 'new-session' },
        speakeasy: { totp: { verify: () => validOTP } }, '../models/user': {
            UserModel: { findById: async () => user, findByEmail: async () => user },
        }, './referral': {}, '../services/emailService': {}, '../models/fingerprint': {} });
    const passkey = load('src/controllers/passkeyController.ts', {
        ...dependencies, 'node:crypto': { randomUUID: () => 'new-passkey-session' },
        '@simplewebauthn/server': { verifyAuthenticationResponse: async () => ({
            verified: true, authenticationInfo: { newCounter: 1 },
        }) },
    }).PasskeyController;
    const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; },
        json(value) { this.data = value; return this; } });
    const req = () => ({ user: { id: user.id }, params: { sessionId: 'one' },
        body: { userId: user.id, token: '123456', otp: '123456', email: 'owner@test.example', id: 'credential' },
        headers: { origin: 'http://localhost', host: 'localhost' },
        get: name => name === 'origin' ? 'http://localhost' : 'localhost',
        hostname: 'localhost', ip: '127.0.0.1', socket: {} });
    return { user, members, sessions, queries, deleted, recovery, controller, middleware, auth, passkey, response, req,
        setOTP(value) { validOTP = value; }, token(scope = 'session_management', expiresIn = '10m') {
            return jwt.sign({ id: 'owner', role: 'user', scope }, secret, { expiresIn });
        } };
}
test('recovery lists only safe metadata and returns a scoped expiring credential', async () => {
    const h = harness(), result = await h.recovery.getSessionRecovery(h.user);
    assert.equal(result.code, 'SESSION_LIMIT_EXCEEDED'); assert.equal(result.sessions.length, 2);
    assert.equal(result.sessions[0].token, undefined);
    const claims = jwt.verify(result.sessionManagementToken, secret);
    assert.equal(claims.scope, 'session_management'); assert.equal(claims.exp - claims.iat, 600);
});
test('stale sessions are removed from the count before displaying a limit', async () => {
    const h = harness(); h.sessions.delete('two');
    assert.equal(await h.recovery.getSessionRecovery(h.user), null); assert.equal(h.members.has('two'), false);
});
test('a limited token cannot call profile, wallet, admin or bulk-delete endpoints', async () => {
    const h = harness();
    for (const [baseUrl, route, method] of [['/user', '/profile', 'GET'], ['/wallet', '/send', 'POST'],
        ['/admin', '/users', 'GET'], ['/auth', '/sessions', 'DELETE']]) {
        const res = h.response(); let next = false;
        await h.middleware({ baseUrl, path: route, method, header: () => `Bearer ${h.token()}` }, res, () => { next = true; });
        assert.equal(res.statusCode, 403); assert.equal(next, false);
    }
});
test('a limited token permits individual session management but still checks blocked accounts and expiry', async () => {
    const h = harness();
    for (const [blocked, expired, expected] of [[false, false, 200], [true, false, 403], [false, true, 401]]) {
        h.user.is_blocked = blocked; const res = h.response(); let next = false;
        await h.middleware({ baseUrl: '/auth', path: '/sessions/one', method: 'DELETE',
            header: () => `Bearer ${h.token('session_management', expired ? -1 : '10m')}` }, res, () => { next = true; });
        assert.equal(res.statusCode, expected); assert.equal(next, expected === 200);
    }
});
test('session deletion rejects a foreign ID and only removes a selected owned session', async () => {
    const h = harness(), foreign = h.req(); foreign.params.sessionId = 'foreign';
    const denied = h.response(); await h.controller.removeSession(foreign, denied);
    assert.equal(denied.statusCode, 404); assert.equal(h.deleted.length, 0);
    await h.controller.removeSession(h.req(), h.response());
    assert.deepEqual(h.deleted, ['session:one']); assert.equal(h.members.has('two'), true);
    const list = h.response(); await h.controller.getActiveSessions(h.req(), list);
    assert.equal(list.data.sessions[0].token, undefined);
});
test('invalid two-factor codes cannot obtain management credentials', async () => {
    const h = harness(); h.setOTP(false); const res = h.response();
    await h.auth.verify2FALogin(h.req(), res);
    assert.equal(res.statusCode, 400); assert.equal(res.data.sessionManagementToken, undefined);
});
test('valid two-factor codes can free a slot and resume without bypassing verification', async () => {
    const h = harness(), res = h.response();
    await h.auth.verify2FALogin(h.req(), res); assert.equal(res.data.code, 'SESSION_LIMIT_EXCEEDED');
    await h.controller.removeSession(h.req(), h.response());
    const success = h.response(); await h.auth.verify2FALogin(h.req(), success);
    assert.equal(success.statusCode, 200); assert.ok(success.data.token);
    assert.equal(h.members.size, 2);
});
test('email and suspicious-login OTPs are not consumed before session recovery succeeds', async () => {
    for (const method of ['verifyEmail', 'verifySuspiciousLogin']) {
        const h = harness(), res = h.response();
        await h.auth[method](h.req(), res); assert.equal(res.data.code, 'SESSION_LIMIT_EXCEEDED');
        assert.equal(h.queries.length, 0);
        await h.controller.removeSession(h.req(), h.response());
        const success = h.response(); await h.auth[method](h.req(), success);
        assert.ok(success.data.token); assert.equal(h.members.size, 2);
    }
});
test('passkey authentication respects the two-session recovery contract and creates a tracked session', async () => {
    const h = harness(), res = h.response();
    await h.passkey.verifyAuth(h.req(), res);
    assert.equal(res.data.code, 'SESSION_LIMIT_EXCEEDED');
    await h.controller.removeSession(h.req(), h.response());
    const success = h.response(); await h.passkey.verifyAuth(h.req(), success);
    assert.equal(success.statusCode, 200); assert.ok(success.data.token);
    assert.equal(h.members.has('new-passkey-session'), true);
    assert.equal(jwt.verify(success.data.token, secret).sessionId, 'new-passkey-session');
});
