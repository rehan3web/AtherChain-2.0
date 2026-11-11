import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import ISO6391 from 'iso-639-1';
import isoCountries from 'i18n-iso-countries';

function load(file, deps = {}, globals = {}) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in deps, `Unexpected import ${name}`);
    return deps[name];
  }, Error, ...globals });
  return exports;
}
const model = load('../components/kyc/model.ts');
const languages = load('../components/kyc/languages.ts', { 'iso-639-1': ISO6391 });

test('practice review switches at exactly 30 and 60 seconds without extending deadlines', () => {
  const start = 100_000;
  for (const [elapsed, status, delay] of [[0, 'pending', 30000], [29999, 'pending', 1], [30000, 'rejected', 30000], [59999, 'rejected', 1], [60000, 'approved', null], [120000, 'approved', null]]) {
    assert.equal(model.kycReviewStatus(start, start + elapsed), status);
    assert.equal(model.kycReviewDelay(start, start + elapsed), delay);
  }
});

test('each KYC outcome retains document/status rows, with a red rejected cross and pending clock', () => {
  const { ResultStep } = load('../components/kyc/Steps.tsx', {
    react: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable' },
    '@expo/vector-icons': { Feather: 'Feather' },
    '@/hooks/useColors': { useColors: () => ({ walletError: '#ff4040', walletPositive: '#00aa66' }) },
    './model': model, './languages': languages, './countries': { COUNTRIES: [] },
    './CountryFlag': { CountryFlag: 'CountryFlag' }, './DocumentIcon': { DocumentIcon: 'DocumentIcon' },
    './Illustration': { IdentityIllustration: 'IdentityIllustration' },
    '@/components/wallet/ConfirmedIcon': { ConfirmedIcon: 'ConfirmedIcon' },
    './parts': { Field: 'Field', Heading: 'Heading', Row: 'Row', s: {} },
  });
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : [tree, ...(tree.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  for (const status of ['pending', 'rejected', 'approved']) {
    const rendered = nodes(ResultStep({ document: 'id', status }));
    assert.equal(rendered.find(n => n.props.testID === 'kyc-result-document').props.children[0], 'ID Card');
    assert.equal(rendered.find(n => n.props.testID === 'kyc-result-status').props.children[0], status[0].toUpperCase() + status.slice(1));
    if (status === 'approved') assert.ok(rendered.find(n => n.type === 'ConfirmedIcon'));
    else {
      const icon = rendered.find(n => n.type === 'Feather');
      assert.equal(icon.props.name, status === 'rejected' ? 'x-circle' : 'clock');
      if (status === 'rejected') assert.equal(icon.props.color, '#ff4040');
    }
  }
});

test('personal details require all fields and a real non-future date of birth', () => {
  assert.equal(Object.keys(model.validatePersonal(model.EMPTY_PERSONAL)).length, 4);
  const good = { name: 'Demo Person', fatherName: 'Demo Parent', dob: '2000-02-29', language: 'hi' };
  assert.equal(Object.keys(model.validatePersonal(good, new Date(2026, 10, 8))).length, 0);
  for (const dob of ['2001-02-29', '2000-13-01', '2027-01-01', '1890-01-01', 'yesterday']) {
    assert.ok(model.validatePersonal({ ...good, dob }, new Date(2026, 10, 8)).dob);
  }
  assert.ok(model.validatePersonal({ ...good, name: '   ' }).name);
});

test('residential fields and image size are validated without storing identity data', () => {
  assert.equal(Object.keys(model.validateResidence(model.EMPTY_RESIDENCE)).length, 4);
  assert.equal(Object.keys(model.validateResidence({ address: 'Demo Street', city: 'Demo City', state: 'Demo State', country: 'Demo Country' })).length, 0);
  assert.match(model.photoError({ uri: 'local://demo', name: 'Photo', size: 5_000_001 }), /5 MB/);
  assert.equal(model.photoError({ uri: 'local://demo', name: 'Photo', size: 5_000_000 }), null);
  assert.ok(model.photoError({ uri: '', name: 'Photo' }));
});

test('language picker includes complete supported ISO list, native names and searchable flags', () => {
  assert.equal(languages.LANGUAGES.length, ISO6391.getAllCodes().length);
  assert.ok(languages.LANGUAGES.length >= 180);
  assert.equal(new Set(languages.LANGUAGES.map(x => x.code)).size, languages.LANGUAGES.length);
  assert.equal(languages.searchLanguages('हिन्दी')[0].code, 'hi');
  assert.equal(languages.searchLanguages('اردو')[0].code, 'ur');
  assert.equal(languages.searchLanguages('Hindi')[0].flag, '🇮🇳');
  assert.ok(languages.searchLanguages('english').some(x => x.code === 'en'));
  assert.equal(languages.searchLanguages('not-a-language-at-all').length, 0);
});

test('photo picker cancellation, errors, capture permissions and front camera are handled', async () => {
  let granted = true;
  let next = { canceled: true };
  const calls = [];
  const picker = {
    CameraType: { front: 'front', back: 'back' },
    requestCameraPermissionsAsync: async () => ({ granted }),
    launchCameraAsync: async options => { calls.push(options); return next; },
    launchImageLibraryAsync: async options => { calls.push(options); return next; },
  };
  const media = load('../components/kyc/media.ts', { 'expo-image-picker': picker, './model': model });
  assert.equal(await media.chooseKycPhoto('library'), null);
  granted = false;
  await assert.rejects(media.chooseKycPhoto('camera', true), /permission/);
  granted = true;
  next = { canceled: false, assets: [{ uri: 'file://demo-photo', type: 'image', fileSize: 1234 }] };
  assert.equal((await media.chooseKycPhoto('camera', true)).uri, 'file://demo-photo');
  assert.equal(calls.at(-1).cameraType, 'front');
  assert.deepEqual(Array.from(calls.at(-1).mediaTypes), ['images']);
  next.assets[0].fileSize = 8_000_000;
  await assert.rejects(media.chooseKycPhoto('library'), /5 MB/);
  next.assets[0] = { uri: 'file://video', type: 'video' };
  await assert.rejects(media.chooseKycPhoto('library'), /not a video/);
});

function flowHarness() {
  const hooks = [];
  const timers = new Map();
  let clock = 1_700_000_000_000;
  const effects = [];
  const navigation = [];
  let cursor = 0;
  let photo = { uri: 'file://sample', name: 'Sample image', size: 1200 };
  let photoCalls = 0;
  let onAppState;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }];
    },
    useRef: initial => {
      const i = cursor++;
      hooks[i] ??= { current: initial };
      return hooks[i];
    },
    useCallback: callback => callback,
    useEffect: (effect, deps = []) => {
      const i = cursor++;
      if (!hooks[i] || deps.some((dep, j) => dep !== hooks[i].deps[j])) {
        hooks[i]?.cleanup?.();
        hooks[i] = { deps };
        effects.push(() => { hooks[i].cleanup = effect(); });
      }
    },
  };
  const { KycScreen } = load('../components/kyc/KycScreen.tsx', {
    react,
    'react-native': { AppState: { currentState: 'active', addEventListener: (_, callback) => { onAppState = callback; return { remove() {} }; } }, BackHandler: { addEventListener: () => ({ remove() {} }) }, Platform: { OS: 'android' }, Pressable: 'Pressable', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: { canGoBack: () => false, back: () => navigation.push('back'), replace: path => navigation.push(path) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/KeyboardAwareScrollViewCompat': { KeyboardAwareScrollViewCompat: 'ScrollView' },
    '@/components/wallet/Sheet': { Sheet: 'Sheet' },
    './model': model,
    './media': { chooseKycPhoto: async (...args) => { photoCalls++; if (photo instanceof Error) throw photo; return typeof photo === 'function' ? photo(...args) : photo; } },
    './Steps': Object.fromEntries(['DocumentStep', 'IntroStep', 'PersonalStep', 'ResidenceStep', 'ResultStep'].map(name => [name, name])),
    './PhotoSlot': { PhotoSlot: 'PhotoSlot' },
    './FaceStep': { FaceStep: 'FaceStep' },
    './LanguageSheet': { LanguageSheet: 'LanguageSheet', CountrySheet: 'CountrySheet' },
    './parts': { Heading: 'Heading', PrimaryButton: 'PrimaryButton', Progress: 'Progress', s: {} },
  }, {
    Date: class extends Date { static now() { return clock; } },
    setTimeout: (callback, delay) => { assert.ok(delay > 0 && delay <= 30000); timers.set(callback, clock + delay); return callback; },
    clearTimeout: callback => timers.delete(callback),
  });
  let tree;
  const nodes = node => !node || typeof node !== 'object' ? [] :
    [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  const render = () => {
    cursor = 0;
    tree = KycScreen();
    effects.splice(0).forEach(effect => effect());
    return tree;
  };
  const find = predicate => nodes(tree).find(predicate);
  const byId = id => find(node => node.props?.testID === id);
  const byType = type => find(node => node.type === type);
  const press = id => { const node = byId(id); assert.ok(node, `Missing ${id}`); node.props.onPress(); render(); };
  const next = () => press('kyc-next');
  render();
  return {
    render, byId, byType, press, next, navigation, photoCalls: () => photoCalls,
    byLabel: label => find(node => node.props?.label === label),
    reopen: () => {
      hooks.forEach(hook => hook?.cleanup?.());
      hooks.length = 0;
      effects.length = 0;
      render();
    },
    setPhoto: value => { photo = value; },
    setAppState: state => { onAppState(state); render(); },
    flushTimers: () => {
      if (!timers.size) return;
      clock = Math.min(...timers.values());
      for (const [callback, due] of [...timers]) if (due <= clock) { timers.delete(callback); callback(); }
      render();
    },
    advance: ms => {
      clock += ms;
      for (const [callback, due] of [...timers]) if (due <= clock) { timers.delete(callback); callback(); }
      render();
    },
    unmount: () => hooks.forEach(hook => hook?.cleanup?.()),
  };
}

function reachDocuments(app) {
  app.press('kyc-start');
  app.byType('DocumentStep').props.onChange('passport'); app.render(); app.next();
  app.byType('PersonalStep').props.onChange({ name: 'Sample Person', fatherName: 'Sample Parent', dob: '2000-01-01', language: 'hi' });
  app.render(); app.next();
  app.byType('ResidenceStep').props.onChange({ address: 'Sample Street', city: 'Sample City', state: 'Sample State', country: 'Sample Country' });
  app.render(); app.next();
}

test('country bottom picker saves selection, closes and keeps the country when navigating back', () => {
  const app = flowHarness();
  assert.equal(app.byId('kyc-start').props.label, 'Start');
  app.press('kyc-start');
  app.byType('DocumentStep').props.onChange('id'); app.render(); app.next();
  app.byType('PersonalStep').props.onChange({ name: 'Sample Person', fatherName: 'Sample Parent', dob: '2000-01-01', language: 'en' });
  app.render(); app.next();
  app.byType('ResidenceStep').props.onChange({ address: 'Sample Street', city: 'Sample City', state: 'Sample State', country: '' });
  app.render(); app.next();
  assert.ok(app.byType('ResidenceStep').props.errors.country);
  app.byType('ResidenceStep').props.onCountry(); app.render();
  assert.equal(app.byType('CountrySheet').props.open, true);
  app.byType('CountrySheet').props.onSelect('Pakistan'); app.render();
  assert.equal(app.byType('CountrySheet').props.open, false);
  assert.equal(app.byType('ResidenceStep').props.value.country, 'Pakistan');
  assert.equal(app.byType('ResidenceStep').props.errors.country, '');
  app.next(); app.press('kyc-back');
  assert.equal(app.byType('ResidenceStep').props.value.country, 'Pakistan');
});

test('country search includes all ISO countries and each has a packaged circular flag', () => {
  const english = JSON.parse(fs.readFileSync(new URL('../node_modules/i18n-iso-countries/langs/en.json', import.meta.url), 'utf8'));
  const data = load('../components/kyc/countries.ts', {
    'i18n-iso-countries': isoCountries,
    'i18n-iso-countries/langs/en.json': english,
  });
  assert.equal(data.COUNTRIES.length, Object.keys(isoCountries.getAlpha2Codes()).length);
  assert.ok(data.COUNTRIES.length >= 249);
  assert.equal(data.searchCountries('pakistan')[0].code, 'PK');
  assert.equal(data.searchCountries('IN').some(c => c.code === 'IN'), true);
  assert.equal(data.searchCountries('not-a-real-country').length, 0);
  const exports = fs.readFileSync(new URL('../node_modules/react-native-svg-circle-country-flags/src/flags/index.ts', import.meta.url), 'utf8');
  for (const country of data.COUNTRIES) {
    const key = country.code[0] + country.code.slice(1).toLowerCase();
    assert.ok(exports.includes(`as ${key} }`), `Missing flag: ${country.code}`);
  }
});

test('document SVGs use supplied paths with theme color and no background box', () => {
  const { DocumentIcon } = load('../components/kyc/DocumentIcon.tsx', {
    react: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    'react-native-svg': { __esModule: true, default: 'Svg', Path: 'Path' },
  });
  const paths = new Set();
  for (const type of ['id', 'passport', 'driving']) {
    const tree = DocumentIcon({ type, color: '#fafafa' });
    assert.equal(tree.type, 'Svg');
    assert.equal(tree.props.viewBox, '0 0 640 640');
    assert.equal(tree.props.width, 24);
    assert.equal(tree.props.children.length, 1);
    const path = tree.props.children[0];
    assert.equal(path.type, 'Path');
    assert.equal(path.props.fill, '#fafafa');
    assert.ok(path.props.d.startsWith('M'));
    paths.add(path.props.d);
  }
  assert.equal(paths.size, 3);
});

test('all KYC pages require valid details and front/back photos before completing the face demo', async () => {
  const app = flowHarness();
  app.press('kyc-start');
  assert.equal(app.byId('kyc-next').props.disabled, true);
  app.next();
  assert.ok(app.byType('DocumentStep'));
  app.byType('DocumentStep').props.onChange('id'); app.render(); app.next();
  app.next();
  assert.ok(app.byType('PersonalStep').props.errors.name);
  app.byType('PersonalStep').props.onLanguage(); app.render();
  assert.equal(app.byType('LanguageSheet').props.open, true);
  app.byType('LanguageSheet').props.onSelect('ur'); app.render();
  assert.equal(app.byType('PersonalStep').props.value.language, 'ur');
  app.byType('PersonalStep').props.onChange({ name: 'Sample', fatherName: 'Parent', dob: '2000-02-29', language: 'ur' });
  app.render(); app.next();
  app.next();
  assert.ok(app.byType('ResidenceStep').props.errors.address);
  app.byType('ResidenceStep').props.onChange({ address: 'Sample Street', city: 'Sample City', state: 'Sample State', country: 'Sample Country' });
  app.render(); app.next();
  assert.equal(app.byType('PhotoSlot').props.side, 'front');
  app.setPhoto(null);
  await app.byType('PhotoSlot').props.onPick('library'); app.render();
  assert.equal(app.byId('kyc-next').props.disabled, true);
  app.setPhoto(new Error('Camera permission denied'));
  await app.byType('PhotoSlot').props.onPick('camera'); app.render();
  assert.match(app.byType('PhotoSlot').props.error, /permission/);
  app.setPhoto({ uri: 'file://front', name: 'Sample front' });
  await app.byType('PhotoSlot').props.onPick('library'); app.render();
  app.byType('PhotoSlot').props.onRemove(); app.render();
  assert.equal(app.byId('kyc-next').props.disabled, true);
  await app.byType('PhotoSlot').props.onPick('library'); app.render(); app.next();
  assert.equal(app.byType('PhotoSlot').props.side, 'back');
  app.next(); assert.equal(app.byType('PhotoSlot').props.side, 'back');
  app.setPhoto({ uri: 'file://back', name: 'Sample back' });
  await app.byType('PhotoSlot').props.onPick('camera'); app.render(); app.next();
  const pickerCalls = app.photoCalls();
  for (let second = 0; second < 6; second++) {
    assert.equal(app.byType('FaceStep').props.index, Math.floor(second / 2));
    assert.equal(app.byType('FaceStep').props.remaining, 2 - second % 2);
    app.flushTimers();
  }
  assert.equal(app.photoCalls(), pickerCalls, 'Face walkthrough never captures a photo');
  assert.ok(app.byType('ResultStep'));
  assert.equal(app.byType('ResultStep').props.document, 'id');
  assert.equal(app.byType('ResultStep').props.status, 'pending');
  assert.equal(app.byLabel('Start again'), undefined);
  app.press('kyc-done');
  assert.deepEqual(app.navigation, ['/settings']);
  app.reopen();
  assert.ok(app.byType('ResultStep'), 'Completed KYC reopens at the result');
  assert.equal(app.byType('ResultStep').props.document, 'id');
  assert.equal(app.byId('kyc-start'), undefined);
  app.press('kyc-back');
  app.reopen();
  assert.ok(app.byType('ResultStep'), 'Back does not reset completion');
});

test('review survives navigation, rejects after 30 seconds, approves after another 30 and catches up after background', async () => {
  const app = flowHarness();
  reachDocuments(app);
  for (let i = 0; i < 2; i++) {
    await app.byType('PhotoSlot').props.onPick('library'); app.render(); app.next();
  }
  for (let i = 0; i < 6; i++) app.flushTimers();
  assert.equal(app.byType('ResultStep').props.status, 'pending');
  app.advance(20000);
  app.press('kyc-done'); app.reopen();
  assert.equal(app.byType('ResultStep').props.status, 'pending');
  app.advance(9999);
  assert.equal(app.byType('ResultStep').props.status, 'pending');
  app.advance(1);
  assert.equal(app.byType('ResultStep').props.status, 'rejected');
  assert.equal(app.byId('kyc-done'), undefined);
  assert.equal(app.byId('kyc-resubmit').props.label, 'Resubmit KYC');
  app.setAppState('background');
  app.advance(30000);
  assert.equal(app.byType('ResultStep').props.status, 'rejected');
  app.setAppState('active'); app.render();
  assert.equal(app.byType('ResultStep').props.status, 'approved');
  assert.ok(app.byId('kyc-done'));
  assert.equal(app.byId('kyc-resubmit'), undefined);
  app.press('kyc-done'); app.reopen();
  assert.equal(app.byType('ResultStep').props.status, 'approved');
  assert.equal(app.byId('kyc-start'), undefined);
});

test('Resubmit KYC starts a fresh form, cancels the old review and resets submission deadlines', async () => {
  const app = flowHarness();
  reachDocuments(app);
  for (let i = 0; i < 2; i++) {
    await app.byType('PhotoSlot').props.onPick('library'); app.render(); app.next();
  }
  for (let i = 0; i < 6; i++) app.flushTimers();
  assert.ok(app.byId('kyc-done'));
  assert.equal(app.byId('kyc-resubmit'), undefined);
  app.advance(30000);
  app.press('kyc-resubmit');
  assert.equal(app.byType('DocumentStep').props.value, null);
  assert.equal(app.byType('ResultStep'), undefined);
  app.advance(60000);
  assert.ok(app.byType('DocumentStep'), 'Old approval cannot replace the new form');
  app.byType('DocumentStep').props.onChange('driving'); app.render(); app.next();
  assert.equal(app.byType('PersonalStep').props.value.name, '');
  app.reopen();
  assert.ok(app.byId('kyc-start'), 'Abandoned resubmission retains no old outcome or identity data');
  reachDocuments(app);
  for (let i = 0; i < 2; i++) {
    await app.byType('PhotoSlot').props.onPick('library'); app.render(); app.next();
  }
  for (let i = 0; i < 6; i++) app.flushTimers();
  assert.equal(app.byType('ResultStep').props.status, 'pending');
  app.advance(29999);
  assert.equal(app.byType('ResultStep').props.status, 'pending');
  app.advance(1);
  assert.equal(app.byType('ResultStep').props.status, 'rejected');
  app.advance(30000);
  assert.equal(app.byType('ResultStep').props.status, 'approved');
});

test('back navigation preserves form values and cancels pending automatic completion', async () => {
  const app = flowHarness();
  reachDocuments(app);
  const add = async () => { await app.byType('PhotoSlot').props.onPick('library'); app.render(); app.next(); };
  await add(); await add();
  app.flushTimers(); app.flushTimers();
  app.byType('FaceStep').props.onBack(); app.render();
  app.flushTimers();
  assert.equal(app.byType('PhotoSlot').props.side, 'back');
  app.next();
  assert.equal(app.byType('FaceStep').props.index, 0, 'Returning starts the walkthrough afresh');
  app.byType('FaceStep').props.onBack(); app.render();
  app.press('kyc-back'); app.press('kyc-back'); app.press('kyc-back');
  assert.equal(app.byType('PersonalStep').props.value.name, 'Sample Person');
});

test('duplicate camera taps are locked and abandoned picker results cannot update the flow', async () => {
  const app = flowHarness();
  reachDocuments(app);
  let resolve;
  app.setPhoto(() => new Promise(done => { resolve = done; }));
  const first = app.byType('PhotoSlot').props.onPick('camera');
  await app.byType('PhotoSlot').props.onPick('camera');
  assert.equal(app.photoCalls(), 1);
  app.unmount();
  resolve({ uri: 'file://sample', name: 'Sample' });
  await first;
  app.render();
  assert.equal(app.byType('PhotoSlot').props.photo, null);
});

test('face walkthrough pauses in background and stops its timer when unmounted', async () => {
  const app = flowHarness();
  reachDocuments(app);
  for (let i = 0; i < 2; i++) {
    await app.byType('PhotoSlot').props.onPick('library'); app.render(); app.next();
  }
  assert.equal(app.byType('FaceStep').props.remaining, 2);
  app.setAppState('background');
  app.flushTimers();
  assert.equal(app.byType('FaceStep').props.remaining, 2);
  app.setAppState('active');
  app.flushTimers();
  assert.equal(app.byType('FaceStep').props.remaining, 1);
  app.unmount();
  app.flushTimers();
  assert.equal(app.byType('FaceStep').props.remaining, 1);
});

test('leaving an entered flow asks for discard confirmation', () => {
  const app = flowHarness();
  app.press('kyc-start');
  app.byType('DocumentStep').props.onChange('driving'); app.render();
  app.press('kyc-back'); app.press('kyc-back');
  assert.equal(app.byType('Sheet').props.open, true);
  assert.deepEqual(app.navigation, []);
  app.press('kyc-discard');
  assert.deepEqual(app.navigation, ['/settings']);
});
