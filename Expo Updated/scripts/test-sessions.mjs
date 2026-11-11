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

const model = load('../components/sessions/store.ts', {
  react: { useSyncExternalStore: (_, snapshot) => snapshot() },
  'react-native': { Platform: { OS: 'android' } },
});
const seed = [
  { id: 'current', device: 'Test Android', platform: 'android', startedAt: '2026-11-08T08:00:00.000Z', current: true },
  { id: 'other', device: 'Test Browser', platform: 'web', startedAt: '2026-11-08T07:00:00.000Z', current: false },
];

test('actual preview starts with only the current local runtime, not fake remote logins', () => {
  const state = model.useSessions();
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].platform, 'android');
  assert.equal(state.sessions[0].current, true);
  assert.ok(Number.isFinite(Date.parse(state.sessions[0].startedAt)));
  state.signOutAll();
  assert.equal(model.useSessions().sessions.length, 0);
  assert.equal(model.useSessions().sessions.length, 0, 'Rerender never recreates a signed-out session');
});

test('individual sign-out removes exactly the selected ID, including the current session', () => {
  const store = model.createSessionStore(seed);
  const previous = store.getSnapshot();
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  assert.equal(store.signOutSession('missing'), false);
  assert.equal(changes, 0);
  assert.equal(store.signOutSession('other'), true);
  assert.equal(store.getSnapshot().length, 1);
  assert.equal(store.getSnapshot()[0].id, 'current');
  assert.equal(previous.length, 2, 'Published snapshots stay immutable');
  assert.equal(store.signOutSession('current'), true);
  assert.equal(store.getSnapshot().length, 0);
  assert.equal(changes, 2);
  unsubscribe();
  store.signOutAll();
  assert.equal(changes, 2);
});

test('log out all clears every session in one update and remains safe when empty', () => {
  const store = model.createSessionStore(seed);
  let changes = 0;
  store.subscribe(() => changes++);
  assert.equal(store.signOutAll(), 2);
  assert.equal(store.getSnapshot().length, 0);
  assert.equal(changes, 1);
  assert.equal(store.signOutAll(), 0);
  assert.equal(changes, 1);
  assert.equal(seed.length, 2);
});

function screenHarness(initial = seed, canGoBack = false) {
  const store = model.createSessionStore(initial);
  const hooks = [];
  const navigation = [];
  const toasts = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in hooks)) hooks[i] = initial;
      return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }];
    },
  };
  const { SessionsScreen } = load('../components/sessions/SessionsScreen.tsx', {
    react,
    'react-native': { Platform: { OS: 'android' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: { canGoBack: () => canGoBack, back: () => navigation.push('back'), replace: route => navigation.push(route) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/wallet/Sheet': { Sheet: 'Sheet' },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
    '@/components/kyc/parts': { PrimaryButton: 'PrimaryButton' },
    './store': { useSessions: () => ({ sessions: store.getSnapshot(), signOutSession: store.signOutSession, signOutAll: store.signOutAll }) },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] :
    [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  const render = () => { cursor = 0; return SessionsScreen(); };
  const byId = id => nodes(render()).find(node => node.props?.testID === id);
  const sheet = () => nodes(render()).find(node => node.type === 'Sheet');
  const press = id => {
    const node = byId(id);
    assert.ok(node, `Missing ${id}`);
    node.props.onPress();
  };
  return { store, byId, sheet, press, navigation, toasts };
}

test('single session UI confirms first, cancel preserves records and confirm removes only the chosen row', () => {
  const app = screenHarness();
  app.press('sessions-sign-out-other');
  assert.equal(app.sheet().props.open, true);
  assert.equal(app.store.getSnapshot().length, 2);
  app.sheet().props.onClose();
  assert.equal(app.sheet().props.open, false);
  assert.equal(app.store.getSnapshot().length, 2);
  app.press('sessions-sign-out-other');
  app.press('sessions-confirm');
  assert.equal(app.store.getSnapshot().length, 1);
  assert.equal(app.store.getSnapshot()[0].id, 'current');
  assert.equal(app.byId('sessions-sign-out-other'), undefined);
  assert.ok(app.byId('sessions-sign-out-current'));
  assert.equal(app.toasts.at(-1).kind, 'success');
});

test('all-session UI confirms, clears the list and shows a complete empty state', () => {
  const app = screenHarness();
  app.press('sessions-sign-out-all');
  assert.equal(app.store.getSnapshot().length, 2);
  assert.equal(app.sheet().props.title, 'Log out all sessions?');
  app.press('sessions-confirm');
  assert.equal(app.store.getSnapshot().length, 0);
  assert.ok(app.byId('sessions-empty'));
  assert.equal(app.byId('sessions-sign-out-all'), undefined);
  assert.equal(app.sheet().props.open, false);
  assert.equal(app.toasts.at(-1).kind, 'success');
});

test('session removed elsewhere is reported honestly instead of a false success', () => {
  const app = screenHarness();
  app.press('sessions-sign-out-other');
  app.store.signOutSession('other');
  app.press('sessions-confirm');
  assert.equal(app.toasts.at(-1).kind, 'error');
  assert.equal(app.store.getSnapshot()[0].id, 'current');
});

test('full page back arrow returns to navigation or falls back to Settings', () => {
  for (const canGoBack of [true, false]) {
    const app = screenHarness([], canGoBack);
    app.press('sessions-back');
    assert.deepEqual(app.navigation, [canGoBack ? 'back' : '/settings']);
    assert.ok(app.byId('sessions-empty'));
  }
});
