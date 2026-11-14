// In-memory fixtures only: no real identity images, API requests or databases.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const frontend = path.resolve(__dirname, '..');
const backend = path.resolve(frontend, '../Backend');
const ts = require(require.resolve('typescript', { paths: [frontend] }));
const jpeg = '/9j/2Q=='; // Synthetic JPEG boundary bytes, not an identity image.
const frame = `data:image/jpeg;base64,${jpeg}`;

function load(file, dependencies = {}, globals = {}) {
    const exports = {};
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
    }).outputText;
    vm.runInNewContext(code, {
        exports, Buffer, FormData, File, Blob, console, ...globals,
        require(name) {
            if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
            return dependencies[name];
        }
    });
    return exports;
}
const photo = load(path.join(frontend, 'src/lib/kycPhoto.ts'));
const file = name => new File([Buffer.from(jpeg, 'base64')], name, { type: 'image/jpeg' });

test('single-photo payload matches Expo and does not invent a biometric confidence score', () => {
    const form = photo.buildKycSubmission({ full_name: 'Test applicant' }, {
        id_front: file('front.jpg'), id_back: file('back.jpg')
    }, frame);
    assert.equal(form.get('face_scan_frame'), frame);
    assert.equal(form.get('verification_score'), null);
    assert.equal(form.get('full_name'), 'Test applicant');
    assert.equal(form.get('id_front').name, 'front.jpg');
    assert.deepEqual(JSON.parse(form.get('verification_logs')), {
        capture: 'front_camera', photosCaptured: 1, automaticLivenessVerified: false
    });
});

test('missing, corrupt or oversized photos and invalid ID files cannot be submitted', () => {
    for (const invalid of ['', 'data:image/jpeg;base64,broken', 'data:image/png;base64,iVBORw0KGgo=', `data:image/jpeg;base64,/9j/${'A'.repeat(8 * 1024 * 1024)}`]) {
        assert.throws(() => photo.validateLivePhoto(invalid));
    }
    for (const invalid of [null, new File([], 'empty.jpg', { type: 'image/jpeg' }), new File(['text'], 'id.txt', { type: 'text/plain' })]) {
        assert.throws(() => photo.buildKycSubmission({}, { id_front: invalid, id_back: file('back.jpg') }, frame));
    }
});

test('capture takes one JPEG frame, resizes large video, and rejects an unready camera', () => {
    const canvas = { getContext: () => ({ drawImage(...args) { canvas.args = args; } }), toDataURL(type, quality) {
        assert.equal(type, 'image/jpeg'); assert.equal(quality, 0.6); return frame;
    } };
    const camera = load(path.join(frontend, 'src/lib/kycPhoto.ts'), {}, {
        document: { createElement(tag) { assert.equal(tag, 'canvas'); return canvas; } }
    });
    assert.throws(() => camera.captureLivePhoto({ readyState: 1, videoWidth: 0, videoHeight: 0 }));
    assert.equal(camera.captureLivePhoto({ readyState: 2, videoWidth: 1920, videoHeight: 1080 }), frame);
    assert.equal(canvas.width, 1280);
    assert.equal(canvas.height, 720);
    assert.equal(canvas.args.length, 5);
});

function backendFixture(options = {}) {
    const queries = [], files = new Map();
    let storedPhoto = null;
    const resolve = name => path.resolve('/fixture', name);
    const client = {
        release() {},
        async query(sql, params) {
            queries.push([sql, params]);
            if (sql.includes('SELECT kyc_status')) return { rows: [{ kyc_status: 'not_submitted' }] };
            if (sql.includes('INSERT INTO kyc_requests')) {
                storedPhoto = params[10];
                return { rows: [{ id: 'test-request' }] };
            }
            return { rows: [] };
        }
    };
    const disk = {
        existsSync: name => files.has(resolve(name)),
        mkdirSync() {},
        writeFileSync: (name, bytes) => files.set(resolve(name), Buffer.from(bytes)),
        unlinkSync: name => files.delete(resolve(name)),
        statSync: name => ({ size: files.get(resolve(name)).length }),
        createReadStream: name => ({ pipe(res) { res.bytes = files.get(resolve(name)); } })
    };
    const db = {
        __esModule: true, default: { connect: async () => client },
        query: async () => ({ rows: options.missing ? [] : [{ face_scan_frame: storedPhoto }] })
    };
    const multer = () => ({});
    multer.diskStorage = value => value;
    const globals = { process: { cwd: () => '/fixture' } };
    const submit = load(path.join(backend, 'src/controllers/kyc.ts'), {
        '../db/postgres': db, fs: disk, path, multer,
        '../models/Transaction': {},
        '../services/wallet': { WalletService: {} },
        '../services/kyc': { KYCService: { checkEligibility: async () => ({ eligible: options.eligible !== false }) } }
    }, globals);
    const admin = load(path.join(backend, 'src/controllers/adminKyc.ts'), {
        '../db/postgres': db, fs: disk, path, './referral': { ReferralController: {} }
    }, globals);
    return { queries, files, submit: submit.submitKyc, serve: admin.serveFaceScan };
}
const response = () => ({
    code: 200,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
    writeHead(code, headers) { this.code = code; this.headers = headers; }
});
const submission = () => ({
    user: { id: 'test-owner' },
    body: {
        full_name: 'Test applicant', father_name: 'Test parent', address: 'Test address',
        city: 'Test city', country: 'Test country', id_type: 'passport', id_number: 'TEST123',
        dob: '2000-01-01', id_expiry: '2099-01-01', language: 'English',
        face_scan_frame: frame, verification_logs: JSON.stringify(photo.PHOTO_CAPTURE_LOGS)
    },
    files: { id_front: [{ path: 'id-front.jpg' }], id_back: [{ path: 'id-back.jpg' }] }
});

test('actual backend stores the submitted photo and serves those same bytes to admin', async () => {
    const f = backendFixture(), submitted = response();
    await f.submit(submission(), submitted);
    assert.equal(submitted.code, 200);
    assert.equal(submitted.body.status, 'pending');
    assert.equal(f.queries.at(-1)[0], 'COMMIT');
    const insert = f.queries.find(([sql]) => sql.includes('INSERT INTO kyc_requests'));
    assert.equal(insert[1][8], 0); // No claimed liveness confidence.
    const served = response();
    await f.serve({ params: { requestId: 'test-request' } }, served);
    assert.equal(served.code, 200);
    assert.deepEqual(served.bytes, Buffer.from(jpeg, 'base64'));
    assert.equal(served.headers['Content-Type'], 'image/jpeg');
});

test('missing photo is rejected and deleted/unavailable admin photos return 404', async () => {
    const f = backendFixture(), request = submission(), result = response();
    delete request.body.face_scan_frame;
    await f.submit(request, result);
    assert.equal(result.code, 400);
    assert.equal(f.files.size, 0);
    const absent = response();
    await backendFixture({ missing: true }).serve({ params: { requestId: 'missing' } }, absent);
    assert.equal(absent.code, 404);
});

test('KYC eligibility remains enforced before photo storage', async () => {
    const f = backendFixture({ eligible: false }), result = response();
    await f.submit(submission(), result);
    assert.equal(result.code, 403);
    assert.equal(f.files.size, 0);
});

test('admin photo endpoint remains inaccessible to missing, invalid or ordinary user sessions', () => {
    let role = 'user', nextCalls = 0;
    const { adminAuth } = load(path.join(backend, 'src/middlewares/admin.ts'), {
        jsonwebtoken: { verify(token) { if (token === 'invalid') throw Error(); return { role }; } },
        '../config/env': { env: { JWT_SECRET: 'fixture-only' } }
    });
    for (const authorization of [undefined, 'Bearer invalid', 'Bearer user']) {
        const result = response();
        adminAuth({ headers: { authorization } }, result, () => nextCalls++);
        assert.equal(result.code, 403);
    }
    role = 'admin';
    adminAuth({ headers: { authorization: 'Bearer admin' } }, response(), () => nextCalls++);
    assert.equal(nextCalls, 1);
    assert.match(fs.readFileSync(path.join(backend, 'src/routes/admin.ts'), 'utf8'),
        /router\.get\('\/kyc\/:requestId\/face-scan', adminAuth, serveFaceScan\)/);
});

test('admin client fetches protected photo/document blobs via the configured API and supports abort', async () => {
    const calls = [], signal = new AbortController().signal;
    let image = new Blob(['fixture'], { type: 'image/jpeg' });
    const service = load(path.join(frontend, 'src/services/kyc.ts'), {
        '@/lib/api': { __esModule: true, default: { get: async (...args) => { calls.push(args); return { data: image }; } } }
    });
    await service.getKycEvidence('photo', 'test-request', signal);
    await service.getKycEvidence('document', 'test-document');
    assert.equal(calls[0][0], '/admin/kyc/test-request/face-scan');
    assert.equal(calls[0][1].responseType, 'blob');
    assert.equal(calls[0][1].signal, signal);
    assert.equal(calls[1][0], '/admin/kyc/document/test-document');
    image = new Blob(['html'], { type: 'text/html' });
    await assert.rejects(service.getKycEvidence('photo', 'test-request'));
    image = new Blob([], { type: 'image/jpeg' });
    await assert.rejects(service.getKycEvidence('photo', 'test-request'));
});

module.exports = { load, frontend, frame };
