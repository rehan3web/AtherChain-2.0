import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, deps) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: name => { assert.ok(name in deps, `Unexpected import ${name}`); return deps[name]; },
  });
  return exports;
}

const model = load('../components/passkeys/store.ts', {
  react: { useSyncExternalStore: (_, snapshot) => snapshot() },
  'react-native': { Platform: { OS: 'android' } },
});

test('practice passkeys start empty and multiple creations have unique IDs and immutable snapshots', () => {
  const store = model.createPasskeyStore('android');
  assert.equal(store.getSnapshot().length, 0);
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  const first = store.createPasskey();
  const snapshot = store.getSnapshot();
  const second = store.createPasskey();
  assert.notEqual(first.id, second.id);
  assert.equal(first.platform, 'android');
  assert.ok(Number.isFinite(Date.parse(first.createdAt)));
  assert.equal(snapshot.length, 1);
  assert.equal(store.getSnapshot().length, 2);
  assert.equal(changes, 2);
  unsubscribe();
  store.createPasskey();
  assert.equal(changes, 2);
});

test('deleting exactly one passkey preserves others and never reuses a removed ID', () => {
  const store = model.createPasskeyStore('web');
  const first = store.createPasskey();
  const second = store.createPasskey();
  assert.equal(store.deletePasskey('missing'), false);
  assert.equal(store.deletePasskey(first.id), true);
  assert.equal(store.getSnapshot().length, 1);
  assert.equal(store.getSnapshot()[0].id, second.id);
  assert.equal(store.deletePasskey(first.id), false);
  store.deletePasskey(second.id);
  assert.equal(store.getSnapshot().length, 0);
  assert.notEqual(store.createPasskey().id, first.id);
});

function harness(canGoBack = false) {
  const store = model.createPasskeyStore('android');
  const hooks = [];
  const navigation = [];
  const toasts = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial;
      return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }];
    },
  };
  const { PasskeysScreen } = load('../components/passkeys/PasskeysScreen.tsx', {
    react,
    'react-native': { Platform: { OS: 'android' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: { canGoBack: () => canGoBack, back: () => navigation.push('back'), replace: route => navigation.push(route) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/wallet/Sheet': { Sheet: 'Sheet' },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
    '@/components/kyc/parts': { Heading: 'Heading', PrimaryButton: 'PrimaryButton', Row: 'Row', s: {} },
    './Illustration': { PasskeyIllustration: 'PasskeyIllustration' },
    './store': { usePasskeys: () => ({ passkeys: store.getSnapshot(), createPasskey: store.createPasskey, deletePasskey: store.deletePasskey }) },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] :
    [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  const render = () => { cursor = 0; return PasskeysScreen(); };
  const byId = id => nodes(render()).find(node => node.props?.testID === id);
  const sheet = () => nodes(render()).find(node => node.type === 'Sheet');
  const press = id => { const node = byId(id); assert.ok(node, `Missing ${id}`); node.props.onPress(); };
  return { store, byId, sheet, press, navigation, toasts };
}

test('onboarding creates first passkey, list adds another and remains populated across renders', () => {
  const app = harness();
  assert.ok(app.byId('passkeys-onboarding'));
  app.press('passkeys-create');
  assert.ok(app.byId('passkeys-list'));
  assert.equal(app.store.getSnapshot().length, 1);
  app.press('passkeys-add');
  assert.equal(app.store.getSnapshot().length, 2);
  assert.equal(app.byId('passkeys-onboarding'), undefined);
});

test('delete requires confirmation, cancel and dismissal preserve records, confirming removes only chosen row', () => {
  const app = harness();
  app.press('passkeys-create');
  app.press('passkeys-add');
  const [first, second] = app.store.getSnapshot();
  app.press(`passkeys-delete-${first.id}`);
  assert.equal(app.sheet().props.open, true);
  assert.equal(app.store.getSnapshot().length, 2);
  app.press('passkeys-cancel');
  assert.equal(app.sheet().props.open, false);
  assert.equal(app.store.getSnapshot().length, 2);
  app.press(`passkeys-delete-${first.id}`);
  app.sheet().props.onClose();
  assert.equal(app.store.getSnapshot().length, 2);
  app.press(`passkeys-delete-${first.id}`);
  app.press('passkeys-confirm');
  assert.equal(app.sheet().props.open, false);
  assert.equal(app.store.getSnapshot().length, 1);
  assert.equal(app.store.getSnapshot()[0].id, second.id);
  app.press(`passkeys-delete-${second.id}`);
  app.press('passkeys-confirm');
  assert.ok(app.byId('passkeys-onboarding'));
  app.press('passkeys-create');
  assert.equal(app.store.getSnapshot().length, 1);
});

test('stale deletion reports missing entry, repeated confirm cannot remove another passkey', () => {
  const app = harness();
  app.press('passkeys-create');
  app.press('passkeys-add');
  const [first, second] = app.store.getSnapshot();
  app.press(`passkeys-delete-${first.id}`);
  app.store.deletePasskey(first.id);
  app.press('passkeys-confirm');
  assert.equal(app.toasts.at(-1).kind, 'error');
  app.press('passkeys-confirm');
  assert.equal(app.store.getSnapshot()[0].id, second.id);
});

test('back returns to previous route or Settings', () => {
  for (const canGoBack of [true, false]) {
    const app = harness(canGoBack);
    app.press('passkeys-back');
    assert.deepEqual(app.navigation, [canGoBack ? 'back' : '/(tabs)/settings']);
  }
});
