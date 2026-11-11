import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, deps = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, ...globals, require: name => {
    assert.ok(name in deps, `Unexpected import: ${name}`);
    return deps[name];
  } });
  return exports;
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  return [node.props?.children].flat(Infinity).map(child => find(child, predicate)).find(Boolean);
}
function harness(history = false) {
  const states = [], effects = [], routes = [];
  let cursor = 0, background, hardware, focusCleanup;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    useRef: initial => {
      const i = cursor++;
      states[i] ??= { current: initial };
      return states[i];
    },
    useCallback: fn => fn,
    useEffect: fn => { effects.push(fn); },
  };
  const demo = load('../components/twofa/demo.ts');
  const { TwoFaScreen } = load('../components/twofa/TwoFaScreen.tsx', {
    react,
    'react-native': {
      Platform: { OS: 'android' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View',
      AppState: { addEventListener: (_, fn) => { background = fn; return { remove() {} }; } },
      BackHandler: { addEventListener: (_, fn) => { hardware = fn; return { remove() {} }; } },
    },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': {
      router: { canGoBack: () => history, back: () => routes.push('back'), replace: r => routes.push(r) },
      useFocusEffect: fn => { effects.push(() => { focusCleanup = fn(); }); },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/wallet/NumericKeypad': { NumericKeypad: 'NumericKeypad' },
    '@/components/wallet/Sheet': { Sheet: 'Sheet' },
    '@/components/wallet/format': { BACKSPACE: 'backspace' },
    '@/components/kyc/parts': { Heading: 'Heading', PrimaryButton: 'PrimaryButton', Progress: 'Progress', s: {} },
    './CodeCircles': { CodeCircles: 'CodeCircles' },
    './Steps': { OverviewStep: 'OverviewStep', SetupStep: 'SetupStep' },
    './demo': demo,
  });
  let tree;
  const render = () => { cursor = 0; effects.length = 0; tree = TwoFaScreen(); return tree; };
  render();
  for (const effect of effects.slice()) effect();
  const node = id => find(tree, n => n.props?.testID === id);
  const component = type => find(tree, n => n.type === type);
  const press = id => { node(id).props.onPress(); render(); };
  const digits = value => { for (const digit of value) { component('NumericKeypad').props.onKey(digit); render(); } };
  const finish = () => { component('CodeCircles').props.onFinished(); render(); };
  return { render, node, component, press, digits, finish, routes, demo,
    background: () => { background('background'); render(); },
    blur: () => { focusCleanup(); render(); },
    hardware: () => { hardware(); render(); },
  };
}

test('full-screen flow uses wallet keypad, circular progress and no OS input', () => {
  const app = harness();
  assert.ok(app.component('OverviewStep'));
  app.press('twofa-enable');
  assert.ok(app.component('SetupStep'));
  app.press('twofa-next');
  assert.ok(app.node('twofa-step-code'));
  assert.equal(app.component('NumericKeypad').props.hideDecimal, true);
  app.digits('12');
  assert.equal(app.component('CodeCircles').props.filled, 2);
  app.component('NumericKeypad').props.onKey('backspace'); app.render();
  assert.equal(app.component('CodeCircles').props.filled, 1);
  app.digits('.x');
  assert.equal(app.component('CodeCircles').props.filled, 1);
  for (const file of ['TwoFaScreen.tsx', 'CodeCircles.tsx']) {
    assert.doesNotMatch(fs.readFileSync(new URL(`../components/twofa/${file}`, import.meta.url), 'utf8'), /<TextInput/);
  }
});

test('123456 rejects and clears for retry; other six digits complete only after animation', () => {
  const app = harness();
  app.press('twofa-enable'); app.press('twofa-next');
  app.digits('123456');
  assert.equal(app.component('CodeCircles').props.phase, 'error');
  assert.equal(app.component('NumericKeypad').props.disabled, true);
  app.digits('9');
  assert.equal(app.component('CodeCircles').props.filled, 6);
  app.finish();
  assert.equal(app.component('CodeCircles').props.filled, 0);
  app.digits('654321');
  assert.equal(app.component('CodeCircles').props.phase, 'success');
  assert.equal(app.demo.isDemoCompleted(), false);
  app.finish();
  assert.equal(app.component('OverviewStep').props.completed, true);
  assert.equal(app.demo.isDemoCompleted(), true);
  assert.equal(load('../components/twofa/demo.ts').isDemoCompleted(), false);
});

test('back and Android back traverse steps; exit uses history or Settings fallback', () => {
  for (const history of [false, true]) {
    const app = harness(history);
    app.press('twofa-enable'); app.press('twofa-next'); app.digits('12');
    app.hardware();
    assert.ok(app.component('SetupStep'));
    app.press('twofa-back');
    assert.ok(app.component('OverviewStep'));
    app.press('twofa-back');
    assert.deepEqual(app.routes, [history ? 'back' : '/(tabs)/settings']);
  }
});

test('background or screen blur cancels entered code and pending success', () => {
  for (const interrupt of ['background', 'blur']) {
    const app = harness();
    app.press('twofa-enable'); app.press('twofa-next'); app.digits('654321');
    app[interrupt]();
    assert.equal(app.component('CodeCircles').props.phase, 'entry');
    assert.equal(app.component('CodeCircles').props.filled, 0);
    app.finish();
    assert.equal(app.demo.isDemoCompleted(), false);
    assert.ok(app.node('twofa-step-code'));
  }
});

test('QR URI contains the same explicitly public demo key that copy uses', () => {
  const demo = load('../components/twofa/demo.ts');
  const uri = new URL(demo.DEMO_URI);
  assert.equal(uri.protocol, 'otpauth:');
  assert.equal(uri.searchParams.get('secret'), demo.DEMO_SECRET);
  assert.match(uri.searchParams.get('issuer'), /DEMO/);
  assert.match(demo.DEMO_SECRET, /^[A-Z2-7]+$/);
  assert.equal(demo.groupedSecret.replaceAll(' ', ''), demo.DEMO_SECRET);
});

test('setup copies the exact QR key and reports clipboard failures honestly', async () => {
  for (const fail of [false, true]) {
    const copied = [], notices = [];
    const { SetupStep } = load('../components/twofa/Steps.tsx', {
      react: {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
        useState: initial => [initial, () => {}], useRef: initial => ({ current: initial }), useEffect() {},
      },
      'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View' },
      '@expo/vector-icons': { Feather: 'Feather' },
      '@/hooks/useColors': { useColors: () => ({}) },
      '@/components/toast/ToastContext': { useToast: () => ({ showToast: notice => notices.push(notice) }) },
      '@/utils/clipboard': { copyText: async value => { if (fail) throw Error('denied'); copied.push(value); } },
      '@/components/kyc/parts': { Heading: 'Heading', Row: 'Row', s: {} },
      './DemoQr': { DemoQr: 'DemoQr' },
      './Illustration': { TwoFaIllustration: 'TwoFaIllustration' },
      './demo': load('../components/twofa/demo.ts'),
    }, { setTimeout: () => 1, clearTimeout() {} });
    const tree = SetupStep();
    const keyText = find(tree, n => n.props?.children?.includes(load('../components/twofa/demo.ts').groupedSecret));
    assert.equal(keyText.props.numberOfLines, 1);
    assert.equal(keyText.props.ellipsizeMode, 'tail');
    await find(tree, n => n.props?.testID === 'twofa-copy-key').props.onPress();
    assert.equal(notices[0].kind, fail ? 'error' : 'success');
    if (fail) assert.deepEqual(copied, []);
    else {
      const qr = find(tree, n => n.type === 'DemoQr');
      assert.equal(new URL(qr.props.value).searchParams.get('secret'), copied[0]);
    }
  }
});

test('2FA presentation keeps plain labels and a KYC/referral-style vector illustration', () => {
  const steps = fs.readFileSync(new URL('../components/twofa/Steps.tsx', import.meta.url), 'utf8');
  const screen = fs.readFileSync(new URL('../components/twofa/TwoFaScreen.tsx', import.meta.url), 'utf8');
  assert.match(steps, /<TwoFaIllustration completed=\{completed\}/);
  assert.match(steps, /'Completed'/);
  assert.match(steps, /title="Scan the QR code"/);
  assert.match(screen, /'Verified'/);
  assert.doesNotMatch(steps + screen, /eyebrow="DEMO"|Demo completed|Scan the demo|Demo verified|Run demo again/);
  assert.match(steps, /Account security is unchanged/);
  const art = fs.readFileSync(new URL('../components/twofa/Illustration.tsx', import.meta.url), 'utf8');
  assert.match(art, /<Svg/);
  assert.match(art, /completed/);
  assert.doesNotMatch(steps, /name=\{completed \? 'check-circle'/);
});

function completeSetup(app) {
  app.press('twofa-enable'); app.press('twofa-next'); app.digits('654321'); app.finish();
}

test('completed setup offers Disable 2FA; confirmation and cancel preserve the setup', () => {
  const app = harness();
  completeSetup(app);
  assert.equal(app.node('twofa-disable').props.label, 'Disable 2FA');
  assert.equal(app.node('twofa-enable'), undefined);
  app.press('twofa-disable');
  assert.equal(app.component('Sheet').props.open, true);
  assert.equal(app.demo.isDemoCompleted(), true);
  app.press('twofa-disable-cancel');
  assert.equal(app.component('Sheet').props.open, false);
  assert.equal(app.demo.isDemoCompleted(), true);
  app.press('twofa-disable');
  app.component('Sheet').props.onClose(); app.render();
  assert.equal(app.demo.isDemoCompleted(), true);
});

test('email code rejects 123456, disables only after success animation, then allows re-enabling', () => {
  const app = harness();
  completeSetup(app);
  app.press('twofa-disable'); app.press('twofa-disable-confirm');
  assert.ok(app.node('twofa-step-disable-code'));
  assert.match(app.component('Heading').props.body, /No email is sent/);
  assert.equal(app.component('NumericKeypad').props.hideDecimal, true);
  app.digits('123456');
  assert.equal(app.component('CodeCircles').props.phase, 'error');
  app.finish();
  assert.equal(app.demo.isDemoCompleted(), true);
  assert.equal(app.component('CodeCircles').props.filled, 0);
  app.digits('987654');
  assert.equal(app.component('CodeCircles').props.phase, 'success');
  assert.equal(app.demo.isDemoCompleted(), true);
  app.finish();
  assert.equal(app.demo.isDemoCompleted(), false);
  assert.equal(app.demo.isDemoDisabled(), true);
  assert.equal(app.component('OverviewStep').props.disabled, true);
  assert.ok(app.node('twofa-enable'));
  completeSetup(app);
  assert.equal(app.demo.isDemoCompleted(), true);
  assert.equal(app.demo.isDemoDisabled(), false);
  assert.ok(app.node('twofa-disable'));
});

test('back, background and blur cannot finish an abandoned disable operation', () => {
  for (const interrupt of ['back', 'hardware', 'background', 'blur']) {
    const app = harness();
    completeSetup(app);
    app.press('twofa-disable'); app.press('twofa-disable-confirm'); app.digits('654321');
    const staleFinish = app.component('CodeCircles').props.onFinished;
    if (interrupt === 'back') app.press('twofa-back');
    else app[interrupt]();
    staleFinish(); app.render();
    assert.equal(app.demo.isDemoCompleted(), true, interrupt);
    assert.equal(app.demo.isDemoDisabled(), false, interrupt);
    if (['back', 'hardware'].includes(interrupt)) assert.ok(app.node('twofa-disable'));
    else assert.equal(app.component('CodeCircles').props.filled, 0);
  }
});
