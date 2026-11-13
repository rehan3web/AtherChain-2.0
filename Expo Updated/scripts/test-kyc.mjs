import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ISO6391 from 'iso-639-1';
import isoCountries from 'i18n-iso-countries';
import { load, hooks, byId, byType, nodes, deferred } from './auth-test-utils.mjs';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4X8AAAAASUVORK5CYII=';
const face = { base64: png, mimeType: 'image/png' };
const photo = { uri: `data:image/png;base64,${png}`, name: 'fixture.png', mimeType: 'image/png' };
const model = load('../components/kyc/model.ts');
const personal = { name: 'Sample Person', fatherName: 'Sample Parent', dob: '2000-01-01', language: 'en', documentNumber: 'SAMPLE', idExpiry: '2099-12-31' };
const residence = { address: 'Sample Street', city: 'Sample City', state: 'Sample State', country: 'Pakistan' };
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
test('language picker retains complete ISO languages, native names and searchable flags', () => {
  const data = load('../components/kyc/languages.ts', { 'iso-639-1': ISO6391 });
  assert.equal(data.LANGUAGES.length, ISO6391.getAllCodes().length);
  assert.equal(new Set(data.LANGUAGES.map(x => x.code)).size, data.LANGUAGES.length);
  assert.equal(data.searchLanguages('हिन्दी')[0].code, 'hi');
  assert.equal(data.searchLanguages('اردو')[0].code, 'ur');
  assert.equal(data.searchLanguages('Hindi')[0].flag, '🇮🇳');
});
test('country search retains all ISO countries and packaged circular flags', () => {
  const english = JSON.parse(fs.readFileSync(new URL('../node_modules/i18n-iso-countries/langs/en.json', import.meta.url)));
  const data = load('../components/kyc/countries.ts', { 'i18n-iso-countries': isoCountries, 'i18n-iso-countries/langs/en.json': english });
  assert.equal(data.COUNTRIES.length, Object.keys(isoCountries.getAlpha2Codes()).length);
  assert.equal(data.searchCountries('pakistan')[0].code, 'PK');
  const exports = fs.readFileSync(new URL('../node_modules/react-native-svg-circle-country-flags/src/flags/index.ts', import.meta.url), 'utf8');
  for (const country of data.COUNTRIES) assert.ok(exports.includes(`as ${country.code[0] + country.code.slice(1).toLowerCase()} }`));
});
test('document SVGs retain supplied paths and theme colors without a background box', () => {
  const h = hooks();
  const { DocumentIcon } = load('../components/kyc/DocumentIcon.tsx', { react: h.react, 'react-native': h.native, 'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' } });
  const paths = new Set();
  for (const type of ['id', 'passport', 'driving']) {
    const tree = DocumentIcon({ type, color: '#fafafa' });
    assert.equal(tree.type, 'Svg'); assert.equal(tree.props.viewBox, '0 0 640 640'); assert.equal(tree.props.children.length, 1);
    assert.equal(tree.props.accessible, undefined); assert.equal(tree.props['aria-hidden'], true);
    assert.equal(tree.props.children[0].props.fill, '#fafafa'); paths.add(tree.props.children[0].props.d);
  }
  assert.equal(paths.size, 3);
});
test('KYC fields keep red borders without inline errors and results default to actual pending review', () => {
  const h = hooks();
  const parts = load('../components/kyc/parts.tsx', { react: h.react, 'react-native': h.native,
    '@expo/vector-icons': { Feather: 'Feather' }, '@/hooks/useColors': { useColors: () => ({ walletError: '#f00' }) } });
  const field = parts.Field({ label: 'Name', error: 'Fixture failure', testID: 'field' });
  assert.equal(byId(field, 'field').props.style[1].borderColor, '#f00');
  assert.equal(nodes(field).some(n => n.props.children?.includes('Fixture failure')), false);
  const { ResultStep } = load('../components/kyc/Steps.tsx', { react: h.react, 'react-native': h.native,
    '@expo/vector-icons': { Feather: 'Feather' }, '@/hooks/useColors': { useColors: () => ({}) },
    './model': model, './languages': { LANGUAGES: [] }, './countries': { COUNTRIES: [] },
    './CountryFlag': { CountryFlag: 'Flag' }, './DocumentIcon': {}, '@/components/wallet/ConfirmedIcon': { ConfirmedIcon: 'Confirmed' },
    './Illustration': { IdentityIllustration: 'Illustration' }, './parts': { s: {} } });
  const result = ResultStep({ document: 'passport' });
  assert.ok(byId(result, 'kyc-result-pending'));
  assert.equal(nodes(result).some(n => n.props.children?.includes('Simulated outcome')), false);
});
function screen(api = {}, picker = async () => photo, initialResource = {}) {
  const h = hooks(), toasts = [], dismissed = [], submissions = [], routes = [];
  const resource = { data: { status: 'not_submitted' }, loading: false, reload: async () => {}, error: null, ...initialResource };
  h.native.AppState.currentState = 'active';
  const { KycScreen } = load('../components/kyc/KycScreen.tsx', {
    '@/components/BackendScreenState': { BackendScreenState: 'BackendScreenState' },
    react: h.react, 'react-native': h.native, '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: { canGoBack: () => false, replace: route => routes.push(route) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/hooks/useColors': { useColors: () => ({}) }, '@/components/KeyboardAwareScrollViewCompat': { KeyboardAwareScrollViewCompat: 'Scroll' },
    '@/components/wallet/Sheet': { Sheet: 'Sheet' }, './model': model, './media': { chooseKycPhoto: picker },
    './Steps': Object.fromEntries(['DocumentStep', 'IntroStep', 'PersonalStep', 'ResidenceStep', 'ResultStep'].map(name => [name, name])),
    './PhotoSlot': { PhotoSlot: 'PhotoSlot' }, './FaceStep': { FaceStep: 'FaceStep' },
    './LanguageSheet': { CountrySheet: 'CountrySheet', LanguageSheet: 'LanguageSheet' },
    './parts': { PrimaryButton: 'Button', Heading: 'Heading', Progress: 'Progress', s: {} },
    '@/services/api': { kycApi: { status: async () => ({ status: 'not_submitted' }), submit: async form => { submissions.push(form); return { status: 'pending' }; }, ...api } },
    '@/services/uploads': { appendImage: async (form, field, file) => form.append(field, new Blob([png], { type: file.mimeType }), file.name) },
    '@/services/refresh': { refreshBackendData() {} },
    '@/hooks/useBackendResource': { useBackendResource: () => resource },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast), dismissToast: id => dismissed.push(id) }) },
    './countries': { COUNTRIES: [{ name: 'Pakistan', code: 'PK' }] },
  }, { FormData, Error, setInterval: () => 1, clearInterval() {} });
  let tree;
  const render = () => { tree = h.render(KycScreen); return tree; };
  const type = name => { const node = byType(tree, name); assert.ok(node, name); return node.props; };
  const press = async id => { const node = byId(tree, id); assert.ok(node, id); assert.equal(!!node.props.disabled, false); await node.props.onPress(); render(); };
  render(); render();
  return { ...h, render, type, press, resource, toasts, dismissed, submissions, routes, id: id => byId(tree, id)?.props };
}
async function reachFace(a) {
  await a.press('kyc-start'); a.type('DocumentStep').onChange('passport'); a.render(); await a.press('kyc-next');
  a.type('PersonalStep').onChange(personal); a.render(); await a.press('kyc-next');
  a.type('ResidenceStep').onChange(residence); a.render(); await a.press('kyc-next');
  await a.type('PhotoSlot').onPick('library'); a.render(); await a.press('kyc-next');
  await a.type('PhotoSlot').onPick('camera'); a.render(); await a.press('kyc-next');
}
for (const status of ['pending', 'approved', 'rejected', 'unverified']) {
  test(`KYC hides onboarding until the delayed backend status resolves to ${status}`, async () => {
    const response = deferred();
    const a = screen({}, undefined, { data: null, loading: true });
    assert.ok(a.id('kyc-loading'));
    assert.equal(a.id('kyc-start'), undefined);
    const request = response.promise.then(data => {
      a.resource.data = data; a.resource.loading = false;
    });
    response.resolve({ status, id_type: 'passport' });
    await request;
    a.render(); a.render();
    if (status === 'unverified') assert.ok(a.id('kyc-start'));
    else {
      assert.equal(a.id('kyc-start'), undefined);
      assert.equal(a.type('ResultStep').status, status);
    }
    a.unmount();
  });
}
test('a failed KYC status request shows retry instead of starting onboarding', async () => {
  let retried = 0;
  const a = screen({}, undefined, { data: null, error: 'Backend unavailable', reload: async () => { retried++; } });
  assert.equal(a.id('kyc-start'), undefined);
  assert.equal(a.id('kyc-loading').error, 'Backend unavailable');
  a.id('kyc-loading').onRetry();
  assert.equal(retried, 1);
  a.unmount();
});
test('mandatory identity fields, real dates, residence and selfie encoding remain validated', () => {
  assert.equal(Object.keys(model.validatePersonal(model.EMPTY_PERSONAL)).length, 6);
  assert.equal(Object.keys(model.validatePersonal(personal)).length, 0);
  for (const dob of ['2001-02-29', '2100-01-01', '1890-01-01']) assert.ok(model.validatePersonal({ ...personal, dob }).dob);
  assert.equal(Object.keys(model.validateResidence(model.EMPTY_RESIDENCE)).length, 4);
  assert.ok(model.photoError({ ...photo, size: 5_000_001 }));
  assert.ok(model.photoError({ ...photo, mimeType: 'image/heic' }));
  assert.equal(model.faceDataUri(face), photo.uri);
  for (const base64 of ['', 'not-a-photo', Buffer.from('not an image').toString('base64')]) assert.throws(() => model.faceDataUri({ ...face, base64 }));
});
test('document picker preserves file metadata, handles cancellation and enforces camera permission', async () => {
  let allowed = false, result = { canceled: true }, options;
  const { chooseKycPhoto } = load('../components/kyc/media.ts', {
    'expo-image-picker': { CameraType: { front: 'front', back: 'back' },
      requestCameraPermissionsAsync: async () => ({ granted: allowed }),
      launchImageLibraryAsync: async () => result,
      launchCameraAsync: async value => { options = value; return result; } }, './model': model,
  }, { Error });
  assert.equal(await chooseKycPhoto('library'), null);
  await assert.rejects(chooseKycPhoto('camera'), /permission/);
  allowed = true;
  const file = new Blob([png], { type: 'image/png' });
  result = { canceled: false, assets: [{ uri: photo.uri, fileName: 'Original.png', fileSize: 100, mimeType: 'image/png', type: 'image', file }] };
  const selected = await chooseKycPhoto('camera', true);
  assert.equal(selected.name, 'Original.png'); assert.equal(selected.mimeType, 'image/png'); assert.equal(selected.file, file);
  assert.equal(options.cameraType, 'front');
  result = { canceled: false, assets: [{ ...result.assets[0], type: 'video' }] };
  await assert.rejects(chooseKycPhoto('library'), /not a video/);
});
test('invalid form fields and picker failures use red toasts, preserve values and allow retry', async () => {
  const a = screen({}, async () => { throw new Error('Camera permission denied'); });
  await a.press('kyc-start'); a.type('DocumentStep').onChange('passport'); a.render(); await a.press('kyc-next');
  await a.press('kyc-next'); assert.equal(a.toasts.at(-1).kind, 'error');
  a.type('PersonalStep').onChange(personal); a.render(); await a.press('kyc-next');
  a.type('ResidenceStep').onChange(residence); a.render(); await a.press('kyc-next');
  await a.type('PhotoSlot').onPick('camera'); a.render();
  assert.equal(a.toasts.at(-1).body, 'Camera permission denied'); assert.equal(a.type('PhotoSlot').busy, false);
});
test('one selfie submits once, protects pending work and opens real pending review', async () => {
  const pending = deferred(), forms = [];
  const a = screen({ submit: form => { forms.push(form); return pending.promise; } });
  await reachFace(a);
  const callback = a.type('FaceStep').onCaptured;
  const request = callback(face); await flush(); a.render();
  assert.equal(a.type('FaceStep').submitting, true); await callback(face);
  a.type('FaceStep').onBack(); a.render(); assert.equal(a.type('FaceStep').submitting, true);
  assert.equal(forms.length, 1); assert.equal(forms[0].get('id_number'), personal.documentNumber);
  assert.equal(forms[0].get('id_expiry'), personal.idExpiry); assert.equal(forms[0].get('country_code'), 'PK');
  assert.equal(forms[0].get('face_scan_frame'), photo.uri);
  assert.equal(JSON.parse(forms[0].get('verification_logs')).photosCaptured, 1);
  assert.equal(JSON.parse(forms[0].get('verification_logs')).automaticLivenessVerified, false);
  pending.resolve({ status: 'pending' }); await request; a.render();
  assert.equal(a.type('ResultStep').status, 'pending');
  await callback(face); assert.equal(forms.length, 1);
});
test('submission failures keep both documents and identity details and require a deliberate new capture', async () => {
  let count = 0;
  const a = screen({ submit: async () => { if (++count === 1) throw new Error('Fixture upload failed'); return { status: 'pending' }; } });
  await reachFace(a); await a.type('FaceStep').onCaptured(face); a.render();
  assert.equal(a.type('FaceStep').submitting, false); assert.equal(a.toasts.at(-1).kind, 'error'); assert.equal(count, 1);
  a.type('FaceStep').onBack(); a.render(); assert.equal(a.type('PhotoSlot').photo.uri, photo.uri);
  await a.press('kyc-back'); assert.equal(a.type('PhotoSlot').photo.uri, photo.uri);
  await a.press('kyc-back'); assert.equal(a.type('ResidenceStep').value.address, residence.address);
  await a.press('kyc-back'); assert.equal(a.type('PersonalStep').value.documentNumber, personal.documentNumber);
  for (let i = 0; i < 4; i++) await a.press('kyc-next');
  await a.type('FaceStep').onCaptured(face); a.render(); assert.equal(count, 2); assert.equal(a.type('ResultStep').status, 'pending');
  assert.ok(a.dismissed.includes(1), 'Successful retry clears its own stale failure notification');
});
test('a lost submit response reconciles actual pending status without resubmission', async () => {
  let count = 0;
  const a = screen({ submit: async () => { count++; throw new Error('Response lost'); }, status: async () => ({ status: 'pending' }) });
  await reachFace(a); await a.type('FaceStep').onCaptured(face); a.render();
  assert.equal(count, 1); assert.equal(a.type('ResultStep').status, 'pending');
});
test('cancelled document picking and abandoned results never attach or submit a photo', async () => {
  const pending = deferred(), a = screen({}, () => pending.promise);
  await a.press('kyc-start'); a.type('DocumentStep').onChange('passport'); a.render(); await a.press('kyc-next');
  a.type('PersonalStep').onChange(personal); a.render(); await a.press('kyc-next');
  a.type('ResidenceStep').onChange(residence); a.render(); await a.press('kyc-next');
  const request = a.type('PhotoSlot').onPick('camera'); a.unmount(); pending.resolve(photo); await request;
  assert.equal(a.submissions.length, 0);
});

function cameraFixture({ granted = true, request, take, submit } = {}) {
  const h = hooks(), permission = { granted, canAskAgain: true }, toasts = [], captured = [];
  let permissionCalls = 0, photos = 0, back = 0, stateChanged;
  h.native.AppState.currentState = 'active'; h.native.AppState.addEventListener = (_event, callback) => { stateChanged = callback; return { remove() {} }; };
  const { FaceStep } = load('../components/kyc/FaceStep.tsx', {
    react: h.react, 'react-native': h.native, '@expo/vector-icons': { Feather: 'Feather' },
    'expo-linear-gradient': { LinearGradient: 'Gradient' },
    'expo-camera': { CameraView: 'Camera', useCameraPermissions: () => [permission, async () => { permissionCalls++; const result = await (request?.() ?? { granted: true }); Object.assign(permission, result); return result; }] },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast), dismissToast() {} }) }, './model': model,
  }, { Error, setTimeout: h.setTimeout, clearTimeout: h.clearTimeout });
  let tree;
  const render = () => { tree = h.render(() => FaceStep({ submitting: false, onBack: () => back++, onCaptured: async value => { captured.push(value); await submit?.(); } })); };
  const ready = () => {
    const c = byType(tree, 'Camera'); assert.ok(c); c.props.ref.current = { takePictureAsync: async () => { photos++; return take ? take() : { base64: png, uri: photo.uri, format: 'png' }; } };
    c.props.onCameraReady();
  };
  const press = async id => { const node = byId(tree, id); assert.ok(node); await node.props.onPress(); await flush(); render(); };
  render();
  return { ...h, render, ready, press, toasts, captured, counts: () => ({ photos, permissionCalls, back }), id: id => byId(tree, id)?.props,
    state: value => { stateChanged(value); render(); }, tree: () => tree };
}
test('camera never captures on mount/ready, then takes exactly one front-camera photo per explicit action', async () => {
  const pending = deferred(), a = cameraFixture({ take: () => pending.promise });
  a.ready(); a.tick(); await flush(); assert.equal(a.counts().photos, 0);
  await a.press('kyc-face-capture'); await a.press('kyc-face-capture');
  assert.equal(a.counts().photos, 1); assert.ok(a.id('kyc-face-loading'));
  pending.resolve({ base64: png, uri: photo.uri, format: 'png' }); await flush(); a.render();
  assert.equal(a.captured.length, 1); assert.equal(a.captured[0].mimeType, 'image/png');
  assert.equal(a.id('kyc-face-capture').disabled, false);
});
test('permission denial is a red toast and never captures/submits; permission success completes the user-started capture', async () => {
  const a = cameraFixture({ granted: false, request: async () => ({ granted: false, canAskAgain: false }) });
  assert.equal(a.counts().permissionCalls, 0); await a.press('kyc-face-capture');
  assert.equal(a.toasts.at(-1).kind, 'error'); assert.equal(a.id('kyc-face-capture').disabled, false); assert.equal(a.captured.length, 0);
  const b = cameraFixture({ granted: false }); await b.press('kyc-face-capture'); b.ready(); await flush(); b.render();
  assert.equal(b.counts().permissionCalls, 1); assert.equal(b.counts().photos, 1); assert.equal(b.captured.length, 1);
});
test('closing, backgrounding, camera timeout and malformed camera output cannot submit', async () => {
  const a = cameraFixture(); await a.press('kyc-face-capture'); await a.press('kyc-face-close'); a.ready(); await flush();
  assert.equal(a.counts().photos, 0); assert.equal(a.counts().back, 1);
  const pending = deferred(), b = cameraFixture({ take: () => pending.promise }); b.ready(); await b.press('kyc-face-capture');
  b.state('background'); pending.resolve({ base64: png, uri: photo.uri }); await flush(); assert.equal(b.captured.length, 0);
  const c = cameraFixture(); await c.press('kyc-face-capture'); c.tick(); c.render();
  assert.equal(c.id('kyc-face-capture').disabled, false); assert.equal(c.toasts.at(-1).kind, 'error');
  const d = cameraFixture({ take: async () => ({ base64: 'broken' }) }); d.ready(); await d.press('kyc-face-capture');
  assert.equal(d.captured.length, 0); assert.equal(d.toasts.at(-1).kind, 'error');
  assert.equal(nodes(d.tree()).some(n => n.type === 'Text' && n.props.children.includes(d.toasts.at(-1).body)), false);
});
