import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, deps = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in deps, `Unexpected import ${name}`);
    return deps[name];
  } });
  return exports;
}
const validation = load('../components/password/validation.ts');
const validate = validation.validatePasswordChange;

test('validation requires all fields, length, different password and matching confirmation', () => {
  assert.equal(Object.keys(validate('', '', '')).length, 3);
  assert.ok(validate('fake old', 'short', 'short').next);
  assert.ok(validate('fake old', 'x'.repeat(129), 'x'.repeat(129)).next);
  assert.ok(validate('same value', 'same value', 'same value').next);
  assert.ok(validate('fake old', 'fake new value', 'not equal').confirm);
  assert.ok(validate('  ', '        ', '        ').current);
  assert.ok(validate('fake old', '        ', '        ').next);
  assert.equal(Object.keys(validate('fake old', 'fake new value', 'fake new value')).length, 0);
});

function harness(canGoBack = false, changePassword = async () => {}) {
  const state = [];
  const refs = [];
  let cursor = 0;
  let refCursor = 0;
  let dismissed = 0;
  const navigation = [];
  const toasts = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
    },
    useRef: initial => refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial }),
  };
  const { ChangePasswordScreen } = load('../components/password/ChangePasswordScreen.tsx', {
    '@/services/api': { userApi: { changePassword } },
    react,
    'react-native': { Keyboard: { dismiss: () => dismissed++ }, KeyboardAvoidingView: 'KeyboardAvoidingView',
      Platform: { OS: 'android' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', TextInput: 'TextInput', View: 'View' },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: { canGoBack: () => canGoBack, back: () => navigation.push('back'), replace: route => navigation.push(route) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
    '@/components/kyc/parts': { Heading: 'Heading', PrimaryButton: 'PrimaryButton', Notice: 'Notice', s: {} },
    './validation': validation,
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  const render = () => { cursor = 0; refCursor = 0; return ChangePasswordScreen(); };
  const byId = id => nodes(render()).find(n => n.props.testID === id);
  const field = id => nodes(render()).find(n => n.props.inputId === id);
  return { state, navigation, toasts, field, byId, nodes,
    get dismissed() { return dismissed; },
    change: (id, value) => field(id).props.onChange(value),
    press: id => byId(id).props.onPress(),
    renderField: (id) => { const f = field(id); cursor = 10; return f.type(f.props); },
  };
}

test('invalid form shows inline errors without success or navigation; edits clear field errors', () => {
  const app = harness();
  app.press('password-submit');
  assert.ok(app.field('password-current').props.error);
  assert.ok(app.field('password-new').props.error);
  assert.ok(app.field('password-confirm').props.error);
  assert.equal(app.navigation.length, 0);
  assert.equal(app.toasts.length, 0);
  app.change('password-current', 'fake old');
  assert.equal(app.field('password-current').props.error, undefined);
  app.change('password-new', 'fake new value');
  app.change('password-confirm', 'mismatch');
  app.press('password-submit');
  assert.ok(app.field('password-confirm').props.error);
  assert.equal(app.navigation.length, 0);
});

test('confirmed backend password change clears values, dismisses keyboard and returns', async () => {
  for (const canGoBack of [true, false]) {
    const calls = [];
    const app = harness(canGoBack, async (...args) => { calls.push(args); });
    app.change('password-current', 'fake old');
    app.change('password-new', 'fake new value');
    app.change('password-confirm', 'fake new value');
    await app.press('password-submit');
    assert.deepEqual(calls, [['fake old', 'fake new value']]);
    assert.equal(app.field('password-current').props.value, '');
    assert.equal(app.field('password-new').props.value, '');
    assert.equal(app.field('password-confirm').props.value, '');
    assert.equal(app.dismissed, 1);
    assert.equal(app.toasts[0].title, 'Password changed');
    assert.deepEqual(app.navigation, [canGoBack ? 'back' : '/(tabs)/settings']);
  }
});

test('password button stays loading until the backend responds and prevents duplicate submits', async () => {
  let finish, calls = 0;
  const app = harness(false, () => { calls++; return new Promise(resolve => { finish = resolve; }); });
  app.change('password-current', 'fake old');
  app.change('password-new', 'fake new value');
  app.change('password-confirm', 'fake new value');
  const request = app.press('password-submit');
  assert.equal(app.byId('password-submit').props.loading, true);
  await app.press('password-submit');
  await app.field('password-confirm').props.onSubmit();
  assert.equal(calls, 1);
  assert.equal(app.toasts.length, 0);
  assert.equal(app.navigation.length, 0);
  finish(); await request;
  assert.equal(app.byId('password-submit').props.loading, false);
  assert.equal(app.toasts[0].kind, 'success');
});

test('password request failure stops loading, retains input and allows retry', async () => {
  let reject, calls = 0;
  const app = harness(false, () => {
    calls++;
    if (calls === 1) return new Promise((_resolve, no) => { reject = no; });
    return Promise.resolve();
  });
  app.change('password-current', 'fake old');
  app.change('password-new', 'fake new value');
  app.change('password-confirm', 'fake new value');
  const request = app.press('password-submit');
  assert.equal(app.byId('password-submit').props.loading, true);
  reject(Error('Current password is incorrect')); await request;
  assert.equal(app.byId('password-submit').props.loading, false);
  assert.equal(app.field('password-new').props.value, 'fake new value');
  assert.equal(app.toasts[0].kind, 'error');
  assert.equal(app.navigation.length, 0);
  await app.press('password-submit');
  assert.equal(calls, 2);
  assert.equal(app.toasts.at(-1).kind, 'success');
});

test('password fields default to masked and opt out of autocorrect and autofill; toggle reveals', () => {
  const app = harness();
  let tree = app.renderField('password-current');
  let input = app.nodes(tree).find(n => n.type === 'TextInput');
  assert.equal(input.props.secureTextEntry, true);
  assert.equal(input.props.autoCorrect, false);
  assert.equal(input.props.autoCapitalize, 'none');
  assert.equal(input.props.autoComplete, 'off');
  assert.equal(input.props.importantForAutofill, 'no');
  app.nodes(tree).find(n => n.props.testID === 'password-toggle-current').props.onPress();
  tree = app.renderField('password-current');
  input = app.nodes(tree).find(n => n.type === 'TextInput');
  assert.equal(input.props.secureTextEntry, false);
});

test('back exits without submitting', () => {
  const app = harness(true);
  app.press('password-back');
  assert.deepEqual(app.navigation, ['back']);
  assert.equal(app.toasts.length, 0);
});
