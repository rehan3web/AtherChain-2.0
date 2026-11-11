import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, deps) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in deps, name); return deps[name]; } });
  return exports;
}
const model = load('../components/notifications/store.ts', { react: { useSyncExternalStore: (_, get) => get() } });

test('reading one item changes only that item, retains list and notifies once', () => {
  const store = model.createNotificationsStore();
  const before = store.getSnapshot();
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  assert.equal(store.markRead('welcome'), true);
  assert.equal(store.getSnapshot().length, before.length);
  assert.equal(store.getSnapshot().find(n => n.id === 'welcome').read, true);
  assert.equal(store.getSnapshot().find(n => n.id === 'security').read, false);
  assert.equal(before.find(n => n.id === 'welcome').read, false);
  assert.equal(store.markRead('welcome'), false);
  assert.equal(store.markRead('missing'), false);
  assert.equal(changes, 1);
  unsubscribe();
  store.markRead('security');
  assert.equal(changes, 1);
});

test('mark all reads every item without deleting; repeated action and empty list are safe', () => {
  const store = model.createNotificationsStore();
  assert.equal(store.markAllRead(), 3);
  assert.ok(store.getSnapshot().every(n => n.read));
  const before = store.getSnapshot();
  assert.equal(store.markAllRead(), 0);
  assert.equal(store.getSnapshot(), before);
  assert.equal(model.createNotificationsStore([]).markAllRead(), 0);
});

function harness(initial, canGoBack = true) {
  const store = model.createNotificationsStore(initial);
  const navigation = [], toasts = [];
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const { NotificationsScreen } = load('../components/notifications/NotificationsScreen.tsx', {
    react,
    'react-native': { Platform: { OS: 'web' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: { canGoBack: () => canGoBack, back: () => navigation.push('back'), replace: path => navigation.push(path) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
    '@/components/kyc/parts': { PrimaryButton: 'PrimaryButton' },
    './store': { useNotifications: () => ({
      notifications: store.getSnapshot(), unreadCount: store.getSnapshot().filter(n => !n.read).length,
      markRead: store.markRead, markAllRead: store.markAllRead,
    }) },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  const byId = id => nodes(NotificationsScreen()).find(n => n.props.testID === id);
  return { byId, store, navigation, toasts, press: id => byId(id).props.onPress() };
}

test('UI taps mark specific then all read, updates count and disables bottom action', () => {
  const app = harness();
  assert.equal(app.byId('notifications-mark-all').props.label, 'Mark as Read');
  assert.equal(app.byId('notifications-mark-all').props.disabled, false);
  app.press('notifications-item-welcome');
  assert.match(app.byId('notifications-item-welcome').props.accessibilityLabel, /^Read /);
  assert.match(app.byId('notifications-item-security').props.accessibilityLabel, /^Unread /);
  assert.equal(app.byId('notifications-unread-count').props.children.flat().join(''), '2 unread');
  app.press('notifications-mark-all');
  assert.equal(app.byId('notifications-unread-count').props.children.flat().join(''), 'All read');
  assert.equal(app.byId('notifications-mark-all').props.disabled, true);
  assert.equal(app.toasts.length, 1);
  // A fresh screen render uses the same store, so navigation does not reset read state.
  assert.match(app.byId('notifications-item-security').props.accessibilityLabel, /^Read /);
});

test('empty inbox and both back navigation paths work', () => {
  for (const canGoBack of [true, false]) {
    const app = harness([], canGoBack);
    assert.ok(app.byId('notifications-empty'));
    assert.equal(app.byId('notifications-mark-all'), undefined);
    app.press('notifications-back');
    assert.equal(app.navigation[0], canGoBack ? 'back' : '/');
  }
});

test('header bell routes to registered full-page notifications screen', () => {
  const dashboard = fs.readFileSync(new URL('../components/dashboard/DashboardScreen.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /next === 'notifications'.*router\.push\('\/notifications'\)/);
  const layout = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /Stack.Screen name="notifications"/);
});
