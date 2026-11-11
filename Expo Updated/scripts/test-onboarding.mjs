import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as phoneLib from 'libphonenumber-js';
import english from 'i18n-iso-countries/langs/en.json' with { type: 'json' };

function load(file, deps) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in deps, `Unexpected dependency: ${name}`); return deps[name]; } });
  return exports;
}
const COUNTRIES = Object.entries(english.countries).map(([code, names]) => ({ code, name: Array.isArray(names) ? names[0] : names }));
const countryDeps = { '@/components/kyc/countries': { COUNTRIES }, 'libphonenumber-js': phoneLib };
const phones = load('../components/onboarding/phoneCountries.ts', countryDeps);
const model = load('../components/onboarding/model.ts', { ...countryDeps, './phoneCountries': phones });

test('signup validates every step, optional referral and country-specific possible phone numbers', () => {
  const draft = { ...model.EMPTY_SIGNUP };
  for (const step of ['identifier', 'username', 'password', 'name', 'country', 'phone'])
    assert.ok(Object.keys(model.validateSignupStep(step, draft)).length, step);
  assert.equal(Object.keys(model.validateSignupStep('referral', draft)).length, 0);
  Object.assign(draft, { identifier: 'practice@example.com', username: 'practice_user', password: 'made-up-123', confirmPassword: 'made-up-123',
    firstName: 'Test', lastName: 'User', country: 'Pakistan', phoneCountry: 'PK', phone: '3001234567' });
  for (const step of model.SIGNUP_STEPS)
    assert.equal(Object.keys(model.validateSignupStep(step, draft)).length, 0, step);
  assert.ok(model.validateSignupStep('password', { ...draft, confirmPassword: 'different' }).confirmPassword);
  assert.ok(model.validateSignupStep('phone', { ...draft, phone: '123' }).phone);
  assert.ok(model.validateSignupStep('phone', { ...draft, phoneCountry: 'FAKE' }).phoneCountry);
  assert.ok(model.validateSignupStep('referral', { ...draft, referral: 'bad code!' }).referral);
  assert.equal(Object.keys(model.validateLogin('test_user', 'made-up-123')).length, 0);
  assert.ok(model.validateLogin('bad email@', 'short').identifier);
  assert.ok(model.validateLogin('test_user', 'short').password);
});

test('calling list supports full country selection and searching by name, ISO or prefix', () => {
  assert.ok(phones.PHONE_COUNTRIES.length > 200);
  assert.equal(phones.getPhoneCountry('PK').dialCode, '+92');
  assert.ok(phones.searchPhoneCountries('Pakistan').some(c => c.code === 'PK'));
  assert.ok(phones.searchPhoneCountries('+44').some(c => c.code === 'GB'));
  assert.ok(phones.searchPhoneCountries('US').some(c => c.code === 'US'));
  assert.equal(phones.searchPhoneCountries('not-a-country').length, 0);
});

test('signup verification uses email even for username signup and never derives it from phone', () => {
  const draft = { ...model.EMPTY_SIGNUP, identifier: 'test_user', phone: '3001234567', phoneCountry: 'PK' };
  assert.ok(model.validateSignupStep('identifier', draft).email);
  draft.email = 'practice@example.com';
  assert.equal(Object.keys(model.validateSignupStep('identifier', draft)).length, 0);
  assert.equal(model.getSignupEmail(draft), 'practice@example.com');
  assert.equal(model.maskSignupEmail(model.getSignupEmail(draft)), 'p•••@example.com');
  draft.identifier = 'other@example.com';
  assert.equal(model.getSignupEmail(draft), 'other@example.com');
  assert.equal(Object.keys(model.validateLogin('test_user', 'made-up-123')).length, 0);
});

const sessionFactory = load('../components/onboarding/session.ts', {
  react: { useEffect() {}, useSyncExternalStore: (_, snapshot) => snapshot() },
  '@react-native-async-storage/async-storage': {},
}).createDemoSessionStore;

test('first launch welcomes, completion persists only a flag, logout restores welcome across restarts', async () => {
  let raw = null;
  const writes = [];
  const storage = { getItem: async () => raw, setItem: async (key, value) => { writes.push([key, value]); raw = value; } };
  const first = sessionFactory(storage);
  await first.load();
  assert.equal(first.getSnapshot().ready, true);
  assert.equal(first.getSnapshot().entered, false);
  await first.enter();
  assert.equal(raw, 'entered');
  const reopened = sessionFactory(storage);
  await reopened.load();
  assert.equal(reopened.getSnapshot().entered, true);
  await reopened.logout();
  assert.equal(reopened.getSnapshot().entered, false);
  const afterLogout = sessionFactory(storage);
  await afterLogout.load();
  assert.equal(afterLogout.getSnapshot().entered, false);
  assert.deepEqual(writes.map(w => w[1]), ['entered', 'welcome']);
});

test('load and write failures are explicit; failed logout does not change entry state', async () => {
  let failRead = true, failWrite = false;
  const storage = { getItem: async () => { if (failRead) throw Error(); return null; },
    setItem: async () => { if (failWrite) throw Error(); } };
  const store = sessionFactory(storage);
  await store.load();
  assert.equal(store.getSnapshot().ready, false);
  assert.match(store.getSnapshot().error, /load/);
  failRead = false;
  await store.load();
  await store.enter();
  failWrite = true;
  await assert.rejects(store.logout(), /save/);
  assert.equal(store.getSnapshot().entered, true);
  const corrupt = sessionFactory({ getItem: async () => 'invalid', setItem: async () => assert.fail('must not overwrite') });
  await assert.rejects(corrupt.enter(), /load/);
});

function hooks() {
  const state = [], refs = [], effects = [], navigation = [];
  let cursor = 0, refCursor = 0, event, blur;
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
    },
    useRef: value => refs[refCursor++] ?? (refs[refCursor - 1] = { current: value }),
    useCallback: fn => fn,
    useEffect: fn => { if (!effects.includes(fn)) effects.push(fn); },
  };
  const router = { canGoBack: () => true, back: () => navigation.push('back'), replace: p => navigation.push(p) };
  const deps = { react, 'react-native': { Keyboard: { dismiss() {} }, View: 'View', Text: 'Text', TextInput: 'TextInput',
    ScrollView: 'ScrollView', Pressable: 'Pressable', Platform: { OS: 'web' },
    BackHandler: { addEventListener: (_, fn) => { event = fn; return { remove() {} }; } },
    AppState: { addEventListener: (_, fn) => { event = fn; return { remove() {} }; } } },
    'expo-router': { router, useFocusEffect: fn => { if (!blur) blur = fn(); } },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@expo/vector-icons': { Feather: 'Feather' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/components/kyc/parts': Object.fromEntries(['Field', 'Heading', 'Notice', 'PrimaryButton', 'Progress'].map(n => [n, n])),
    './Shell': { Shell: 'Shell', StepTransition: 'StepTransition' },
    './SignupFields': { AuthField: 'AuthField', PasswordField: 'PasswordField', PhoneField: 'PhoneField', SelectField: 'SelectField', noStoreProps: {} },
    './model': model, './phoneCountries': phones,
  };
  deps['@/components/kyc/parts'].s = {};
  const nodes = node => !node || typeof node !== 'object' ? [] : [
    node,
    ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes),
    ...nodes(node.props?.footer),
  ];
  let component;
  const render = () => { cursor = refCursor = 0; return component(); };
  const byId = id => nodes(render()).find(n => n.props.testID === id);
  const byType = type => nodes(render()).find(n => n.type === type);
  return { deps, state, navigation, effects, byId, byType, render,
    init: fn => { component = fn; render(); effects.splice(0).forEach(fn => fn()); },
    press: id => byId(id).props.onPress(),
    change: (id, text) => byId(id).props.onChangeText(text),
    back: () => event(), blur: () => blur?.(),
  };
}

test('signup follows all eight steps, blocks invalid input and supports referral Skip and back', () => {
  const app = hooks();
  const { SignupScreen } = load('../components/onboarding/SignupScreen.tsx', { ...app.deps,
    '@/components/kyc/LanguageSheet': { CountrySheet: 'CountrySheet' },
    '@/components/kyc/countries': { COUNTRIES },
    './CallingCodeSheet': { CallingCodeSheet: 'CallingCodeSheet' }, './SignupOtp': { SignupOtp: 'SignupOtp' },
  });
  app.init(SignupScreen);
  assert.ok(app.byId('signup-step-identifier'));
  app.press('signup-next');
  assert.ok(app.byId('signup-identifier').props.error);
  app.change('signup-identifier', 'practice_user');
  assert.ok(app.byId('signup-email'));
  app.press('signup-next');
  assert.ok(app.byId('signup-email').props.error);
  app.change('signup-identifier', 'practice@example.com'); app.press('signup-next');
  app.change('signup-username', 'practice_user'); app.press('signup-next');
  app.change('signup-password', 'made-up-123'); app.change('signup-confirm', 'different'); app.press('signup-next');
  assert.ok(app.byId('signup-confirm').props.error);
  app.change('signup-confirm', 'made-up-123'); app.press('signup-next');
  app.change('signup-first-name', 'Test'); app.change('signup-last-name', 'User'); app.press('signup-next');
  app.byType('CountrySheet').props.onSelect('Pakistan'); app.press('signup-next');
  app.change('signup-referral', 'not valid!'); app.press('signup-next');
  assert.ok(app.byId('signup-referral').props.error);
  app.press('signup-skip');
  app.byType('CallingCodeSheet').props.onSelect('PK');
  app.byType('PhoneField').props.onChange('3001234567');
  app.press('signup-next');
  assert.ok(app.byType('SignupOtp'));
  assert.equal(app.byType('Shell'), undefined, 'OTP must not inherit form keyboard/layout wrappers');
  assert.equal(app.byType('SignupOtp').props.maskedEmail, 'p•••@example.com');
  assert.equal(app.byId('signup-next'), undefined);
  app.render().props.onBack();
  assert.ok(app.byId('signup-step-phone'));
});

test('OTP uses app keypad/circles, rejection resets, success enters only after animation and blocks stale callbacks', async () => {
  const app = hooks();
  let calls = 0, cleared = 0, reject = false;
  const cancelRef = { current: () => true };
  const { SignupOtp } = load('../components/onboarding/SignupOtp.tsx', { ...app.deps,
    '@/components/wallet/NumericKeypad': { NumericKeypad: 'NumericKeypad' },
    '@/components/wallet/format': { BACKSPACE: 'backspace' },
    '@/components/twofa/CodeCircles': { CodeCircles: 'CodeCircles' },
    '@/components/twofa/demo': { CODE_LENGTH: 6, DEMO_REJECT_CODE: '123456' },
    './session': { enterDemo: async () => { calls++; if (reject) throw Error(); } },
  });
  app.init(() => SignupOtp({ maskedEmail: 'p•••@example.com', onDone: () => cleared++, cancelRef, onBack() {} }));
  const type = code => { for (const digit of code) app.byType('NumericKeypad').props.onKey(digit); };
  assert.equal(app.byType('TextInput'), undefined);
  assert.ok(app.byId('signup-step-otp'));
  assert.equal(app.byId('signup-step-otp').type, 'ScrollView');
  assert.equal(app.byId('signup-step-otp').props.contentContainerStyle[1].flexGrow, 1);
  assert.equal(app.byType('NumericKeypad').props.hideDecimal, true);
  assert.equal(app.byType('Heading').props.title, 'Enter the email code');
  assert.match(app.byType('Heading').props.body, /p•••@example\.com/);
  assert.doesNotMatch(app.byType('Heading').props.body, /SMS|phone/i);
  type('123456');
  assert.equal(app.byType('CodeCircles').props.phase, 'error');
  app.byType('CodeCircles').props.onFinished();
  assert.equal(app.byType('CodeCircles').props.filled, 0);
  type('654321');
  const stale = app.byType('CodeCircles').props.onFinished;
  assert.equal(calls, 0);
  cancelRef.current(); stale();
  assert.equal(calls, 0);
  type('654321'); reject = true;
  app.byType('CodeCircles').props.onFinished();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.navigation.length, 0);
  reject = false; app.press('signup-retry');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2);
  assert.equal(cleared, 1);
  assert.equal(app.navigation[0], '/');
});

test('onboarding fields have visible idle, focus and error borders without changing KYC', () => {
  const app = hooks();
  app.deps.react.forwardRef = fn => props => fn(props, null);
  const colors = { walletMuted: '#a3a3a3', walletInk: '#171717', walletError: '#b91c1c', walletField: '#f5f5f5' };
  const fields = load('../components/onboarding/SignupFields.tsx', { ...app.deps,
    '@expo/vector-icons': { Feather: 'Feather' },
    '@/hooks/useColors': { useColors: () => colors },
    '@/components/kyc/CountryFlag': { CountryFlag: 'CountryFlag' },
  });
  assert.equal(fields.useBorder(), colors.walletMuted);
  assert.equal(fields.useBorder(undefined, true), colors.walletInk);
  assert.equal(fields.useBorder('Invalid', true), colors.walletError);
  app.init(() => fields.AuthField({ testID: 'field', label: 'Email' }));
  const style = () => Object.assign({}, ...app.byId('field').props.style.filter(Boolean));
  assert.equal(style().borderColor, colors.walletMuted);
  app.byId('field').props.onFocus({});
  assert.equal(style().borderColor, colors.walletInk);
  app.byId('field').props.onBlur({});
  assert.equal(style().borderColor, colors.walletMuted);
});

test('shared wallet keypad fixes three equal columns in four rows and preserves all key actions', () => {
  const app = hooks();
  const pressed = [];
  let dismissed = 0, cleared = 0;
  const { NumericKeypad } = load('../components/wallet/NumericKeypad.tsx', {
    ...app.deps,
    'react-native': { ...app.deps['react-native'], StyleSheet: { create: v => v }, Keyboard: { dismiss: () => dismissed++ } },
    './format': { BACKSPACE: 'del' },
  });
  for (const hideDecimal of [true, false]) {
    const tree = NumericKeypad({ hideDecimal, onKey: k => pressed.push(k), onClear: () => cleared++ });
    const rows = tree.props.children.flat();
    assert.equal(rows.length, 4);
    for (const row of rows) {
      assert.equal(row.props.style.flexDirection, 'row');
      const keys = row.props.children.flat();
      assert.equal(keys.length, 3);
      for (const key of keys) {
        const style = typeof key.props.style === 'function' ? key.props.style({ pressed: false }) : key.props.style;
        const box = Object.assign({}, ...style.filter(Boolean));
        assert.equal(box.flex, 1);
        assert.equal(box.height, 50);
        assert.equal(box.width, undefined);
      }
    }
    const zero = rows[3].props.children.flat()[1];
    zero.props.onPress();
    rows[3].props.children.flat()[2].props.onLongPress();
    assert.equal(!!rows[3].props.children.flat()[0].props.onPress, !hideDecimal);
  }
  assert.equal(dismissed, 2);
  assert.equal(cleared, 2);
  assert.deepEqual(pressed, ['0', '0']);
});

test('dummy login validates, clears fields on success, and does not navigate on failed preference save', async () => {
  const app = hooks();
  let fail = true;
  const { LoginScreen } = load('../components/onboarding/LoginScreen.tsx', { ...app.deps,
    './session': { useDemoSession: () => ({ pending: false, error: null }), enterDemo: async () => { if (fail) throw Error(); } },
  });
  app.init(LoginScreen);
  assert.equal(app.byId('login-password'), undefined);
  await app.press('login-next');
  assert.ok(app.byId('login-identifier').props.error);
  app.change('login-identifier', 'test_user');
  await app.press('login-next');
  assert.equal(app.byId('login-identifier'), undefined);
  await app.press('login-submit');
  assert.ok(app.byId('login-password').props.error);
  app.change('login-password', 'made-up-123');
  await app.press('login-submit');
  assert.equal(app.navigation.length, 0);
  fail = false;
  await app.press('login-submit');
  assert.equal(app.navigation[0], '/');
  assert.equal(app.byId('login-password').props.value, '');
});

test('only the explicit banned demo identifier is recognized, ignoring case and edge spaces', () => {
  for (const identifier of ['ban@test.com', ' BAN@Test.com ']) assert.equal(model.isBannedDemoLogin(identifier), true);
  for (const identifier of ['ban', 'user@test.com', 'ban@test.com.evil', 'otherban@test.com']) assert.equal(model.isBannedDemoLogin(identifier), false);
});

test('banned password and passkey login show the banned screen without saving an entered session', async () => {
  for (const method of ['password', 'passkey']) {
    const app = hooks();
    const { LoginScreen } = load('../components/onboarding/LoginScreen.tsx', { ...app.deps,
      './session': { useDemoSession: () => ({ pending: false, error: null }), enterDemo: async () => assert.fail('Banned login must not enter the wallet') },
    });
    app.init(LoginScreen);
    app.change('login-identifier', ' BAN@Test.com ');
    if (method === 'password') {
      app.press('login-next');
      await app.press('login-submit');
      assert.equal(app.navigation.length, 0, 'Invalid password must still be validated');
      app.change('login-password', 'made-up-123');
      await app.press('login-submit');
      assert.equal(app.byId('login-password').props.value, '');
    } else {
      app.press('login-passkey');
      await app.press('login-passkey-confirm');
    }
    assert.deepEqual(app.navigation, ['/account-banned']);
  }
});

test('banned screen matches KYC artwork and rows, with Login left and Help right', () => {
  const app = hooks();
  app.deps['expo-router'].router.push = path => app.navigation.push(path);
  const { AccountBannedScreen } = load('../components/onboarding/AccountBannedScreen.tsx', {
    ...app.deps,
    'react-native': { ...app.deps['react-native'], StyleSheet: { create: styles => styles } },
    '@/components/kyc/Illustration': { IdentityIllustration: 'IdentityIllustration' },
    './Shell': { WRAP: {}, useInsets: () => ({ top: 24, bottom: 24 }) },
  });
  app.init(AccountBannedScreen);
  assert.equal(app.byType('IdentityIllustration').props.icon, 'x');
  assert.ok(app.byId('account-banned-status').props.children.includes('Banned'));
  assert.ok(app.byId('account-banned-reason').props.children.includes('Abuse of App'));
  const footer = app.render().props.children[1];
  assert.equal(footer.props.children[0].props.children[0].props.label, 'Login');
  assert.equal(footer.props.children[1].props.children[0].props.label, 'Help');
  app.press('account-banned-login');
  app.press('account-banned-help');
  assert.deepEqual(app.navigation, ['/login', '/help']);
  const layout = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  const loggedOut = layout.slice(layout.indexOf('guard={!entry.entered}'), layout.indexOf('</Stack.Protected>'));
  assert.match(loggedOut, /name="account-banned"/);
  const publicHelp = layout.slice(layout.indexOf('</Stack.Protected>'), layout.indexOf('guard={entry.entered}'));
  assert.match(publicHelp, /name="help"/);
  assert.match(publicHelp, /name="ticket\/\[id\]"/);
});

test('split login back preserves identifier, clears password and supports Android back', () => {
  const app = hooks();
  const { LoginScreen } = load('../components/onboarding/LoginScreen.tsx', { ...app.deps,
    './session': { useDemoSession: () => ({ pending: false, error: null }), enterDemo: async () => assert.fail('no login expected') },
  });
  app.init(LoginScreen);
  app.change('login-identifier', 'practice@example.com');
  app.press('login-next');
  app.change('login-password', 'made-up-123');
  app.byType('Shell').props.onBack();
  assert.equal(app.byId('login-identifier').props.value, 'practice@example.com');
  app.press('login-next');
  assert.equal(app.byId('login-password').props.value, '');
  app.render(); app.back();
  assert.ok(app.byId('login-identifier'));
  app.render(); app.back();
  assert.equal(app.navigation[0], 'back');
});

test('passkey practice validates identifier, supports cancel and explicit save retry', async () => {
  const app = hooks();
  let count = 0, fail = true;
  const { LoginScreen } = load('../components/onboarding/LoginScreen.tsx', { ...app.deps,
    './session': { useDemoSession: () => ({ pending: false, error: null }), enterDemo: async () => { count++; if (fail) throw Error('save failed'); } },
  });
  app.init(LoginScreen);
  app.press('login-passkey');
  assert.ok(app.byId('login-identifier').props.error);
  app.change('login-identifier', 'practice_user');
  app.press('login-passkey');
  assert.equal(app.byId('login-password'), undefined);
  app.press('login-passkey-cancel');
  assert.equal(count, 0);
  assert.equal(app.byId('login-identifier').props.value, 'practice_user');
  app.press('login-passkey');
  await app.press('login-passkey-confirm');
  assert.equal(app.navigation.length, 0);
  assert.equal(app.byId('login-passkey-confirm').props.label, 'Retry');
  fail = false;
  await app.press('login-passkey-confirm');
  assert.equal(count, 2);
  assert.equal(app.navigation[0], '/');
});

test('pending passkey entry blocks double confirmation/back and cannot navigate after blur', async () => {
  const app = hooks();
  let resolve, count = 0;
  const { LoginScreen } = load('../components/onboarding/LoginScreen.tsx', { ...app.deps,
    './session': { useDemoSession: () => ({ pending: false, error: null }), enterDemo: () => { count++; return new Promise(r => { resolve = r; }); } },
  });
  app.init(LoginScreen);
  app.change('login-identifier', 'practice_user');
  app.press('login-passkey'); app.press('login-passkey-confirm'); app.press('login-passkey-confirm');
  app.byType('Shell').props.onBack();
  assert.ok(app.byId('login-passkey-cancel'));
  assert.equal(count, 1);
  app.blur(); resolve(); await Promise.resolve(); await Promise.resolve();
  assert.equal(app.navigation.length, 0);
});

test('root gate registers welcome, login and signup separately from entered app screens', () => {
  const root = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(root, /Stack\.Protected guard=\{!entry\.entered\}/);
  assert.match(root, /Stack\.Protected guard=\{entry\.entered\}/);
  assert.match(root, /guard=\{entry\.entered\} redirectTo="\/onboarding"/);
  assert.match(root, /guard=\{!entry\.entered\} redirectTo="\/"/);
  for (const route of ['onboarding', 'login', 'signup']) assert.match(root, new RegExp(`Stack.Screen name="${route}"`));
  const settings = fs.readFileSync(new URL('../components/settings/SettingsScreen.tsx', import.meta.url), 'utf8');
  assert.match(settings, /await logoutDemo\(\)/);
  assert.match(settings, /settings-logout-confirm/);
  const dashboard = fs.readFileSync(new URL('../components/dashboard/DashboardScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(dashboard, /ThemeSwitch|header-theme-switch/);
  assert.match(settings, /AppearancePanel/);
});
