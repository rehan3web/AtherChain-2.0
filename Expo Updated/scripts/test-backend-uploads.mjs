import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { load } from './auth-test-utils.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4X8AAAAASUVORK5CYII=', 'base64');
const { installFormDataPatch } = load('../node_modules/expo/src/winter/FormData.ts', {}, { Blob });
class NativeForm { constructor() { this._parts = []; } }
const ExpoForm = installFormDataPatch(NativeForm);
const { convertFormDataAsync } = load('../node_modules/expo/src/winter/fetch/convertFormData.ts', {
  '../../utils/blobUtils': { blobToArrayBufferAsync: blob => blob.arrayBuffer() },
}, { Blob, Uint8Array, TextEncoder });
function uploads(platform, source = {}) {
  const files = new Map(), reads = [];
  class File {
    constructor(uri) { Object.assign(this, { exists: true, size: png.length, type: 'image/png' }, source); this.uri = uri; files.set(uri, this); }
    bytes() { reads.push(this.uri); return Promise.resolve(new Uint8Array(png)); }
  }
  return { ...load('../services/uploads.ts', { 'react-native': { Platform: { OS: platform } }, 'expo-file-system': { File } },
    { Blob, fetch: async () => new Response(png, { headers: { 'Content-Type': 'image/png' } }) }), reads };
}
test('reproduces SDK 58 native failure with the old URI-only descriptor', async () => {
  const form = new ExpoForm();
  form.append('id_front', { uri: 'file:///fixture.png', name: 'front.png', type: 'image/png' });
  await assert.rejects(convertFormDataAsync(form), /Unsupported FormDataPart implementation/);
});
test('real Expo native encoder preserves document bytes, filename and MIME for both native platforms', async () => {
  for (const platform of ['ios', 'android']) {
    const app = uploads(platform), form = new ExpoForm();
    form.append('full_name', 'Sample Person');
    for (const field of ['id_front', 'id_back', 'image'])
      await app.appendImage(form, field, { uri: `file:///${field}.png`, name: `${field}.png`, mimeType: 'image/png' }, 5_000_000);
    const { body, boundary } = await convertFormDataAsync(form);
    const parsed = await new Response(body, { headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` } }).formData();
    for (const field of ['id_front', 'id_back', 'image']) {
      assert.equal(parsed.get(field).name, `${field}.png`); assert.equal(parsed.get(field).type, 'image/png');
      assert.deepEqual(Buffer.from(await parsed.get(field).arrayBuffer()), png);
    }
    assert.equal(app.reads.length, 3); assert.equal(parsed.get('full_name'), 'Sample Person');
  }
});
test('web appends real Blobs, supports picker File input and preserves PNG bytes without JPEG relabeling', async () => {
  const app = uploads('web'), form = new FormData();
  await app.appendImage(form, 'id_front', { uri: 'blob:fixture', name: 'Original.png' });
  await app.appendImage(form, 'id_back', { uri: 'blob:expired', name: 'Back.png', file: new Blob([png], { type: 'image/png' }) });
  for (const field of ['id_front', 'id_back']) {
    assert.equal(form.get(field).type, 'image/png');
    assert.deepEqual(Buffer.from(await form.get(field).arrayBuffer()), png);
  }
  assert.equal(form.get('id_front').name, 'Original.png');
});
test('unreadable, empty, oversized and unsupported image inputs fail before submission', async () => {
  for (const source of [{ exists: false }, { size: 0 }, { size: 5_000_001 }, { type: 'image/heic' }]) {
    const app = uploads('android', source);
    await assert.rejects(app.appendImage(new ExpoForm(), 'id_front', { uri: 'file:///fixture', name: 'fixture' }, 5_000_000));
  }
  const app = uploads('web');
  await assert.rejects(app.appendImage(new FormData(), 'image', { uri: '', name: 'front.png' }), /Select/);
});

function controller({ eligible = true, userStatus = 'not_submitted' } = {}) {
  const queries = [], writes = new Map();
  const client = { release() {}, query: async (sql, params) => {
    queries.push([sql, params]);
    return sql.includes('SELECT kyc_status') ? { rows: [{ kyc_status: userStatus, is_blocked: false }] }
      : sql.includes('RETURNING id') ? { rows: [{ id: 'fixture-request' }] } : { rows: [] };
  } };
  const multer = () => ({}); multer.diskStorage = value => value;
  const module = load('../../Backend/src/controllers/kyc.ts', {
    '../db/postgres': { __esModule: true, default: { connect: async () => client }, query: async () => ({ rows: [] }) },
    multer, path, fs: { existsSync: filename => writes.has(filename), mkdirSync() {}, unlinkSync: filename => writes.delete(filename), writeFileSync: (filename, bytes) => writes.set(filename, bytes) },
    '../services/wallet': { WalletService: {} },
    '../services/kyc': { KYCService: { checkEligibility: async () => ({ eligible, reasons: ['fixture eligibility restriction'] }) } },
  }, { Buffer, console: { error() {} } });
  return { queries, writes, submit: async body => {
    const result = { status: 200, body: null }, res = { status(value) { result.status = value; return res; }, json(value) { result.body = value; } };
    await module.submitKyc({ user: { id: 'fixture-owner' }, body, files: {
      id_front: [{ path: 'fixture/front.png' }], id_back: [{ path: 'fixture/back.png' }],
    } }, res);
    return result;
  } };
}
const valid = { full_name: 'Sample Person', father_name: 'Sample Parent', address: 'Sample Street', city: 'Sample City',
  country: 'Pakistan', country_code: 'PK', id_type: 'passport', id_number: 'SAMPLE', dob: '2000-01-01',
  id_expiry: '2099-12-31', language: 'en', face_scan_frame: `data:image/png;base64,${png.toString('base64')}`,
  verification_logs: '{"photosCaptured":1,"automaticLivenessVerified":false}' };
test('backend keeps eligibility and mandatory identity fields enforced', async () => {
  assert.equal((await controller({ eligible: false }).submit(valid)).status, 403);
  for (const field of ['id_number', 'id_expiry', 'language', 'face_scan_frame']) {
    const fixture = controller(), result = await fixture.submit({ ...valid, [field]: '' });
    assert.equal(result.status, 400); assert.equal(fixture.queries.length, 0); assert.equal(fixture.writes.size, 0);
  }
});
test('actual KYC controller commits pending review, not approval, before returning a pending receipt', async () => {
  const app = controller(), result = await app.submit(valid);
  assert.equal(result.status, 200); assert.equal(result.body.status, 'pending');
  assert.equal(app.queries.at(-1)[0], 'COMMIT');
  assert.ok(app.queries.some(([sql]) => sql.includes("kyc_status = 'pending'")));
  assert.equal(app.queries.some(([sql]) => sql.includes("'approved'")), false);
  assert.deepEqual([...app.writes.values()][0], png);
});
