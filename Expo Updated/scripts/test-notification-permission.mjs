import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}, runtime = {}) {
  const source = fs.readFileSync(new URL(`../components/notification-permission/${file}`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, setInterval, clearInterval, ...runtime, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const { createNotificationPermissionStore } = load('model.ts');
const granted = { granted: true, canAskAgain: false };
const denied = { granted: false, canAskAgain: false };
const askable = { granted: false, canAskAgain: true };
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(initial = askable, requestResult = denied) {
  let permission = initial;
  const calls = { read: 0, request: 0, settings: 0 };
  const adapter = {
    enabled: true,
    read: async () => { calls.read++; return permission; },
    request: async () => { calls.request++; permission = requestResult; return permission; },
    openSettings: async () => { calls.settings++; },
  };
  return { adapter, calls, setPermission: value => { permission = value; }, store: createNotificationPermissionStore(adapter) };
}

test('already-granted permission opens the normal app without another system prompt', async () => {
  const { store, calls } = harness(granted);
  assert.equal(store.getSnapshot().phase, 'checking');
  await store.start();
  assert.equal(store.getSnapshot().phase, 'allowed');
  assert.equal(calls.request, 0);
});

test('startup makes one real request when the OS allows asking and proceeds after allow', async () => {
  const { store, calls } = harness(askable, granted);
  await Promise.all([store.start(), store.start(), store.start()]);
  assert.equal(calls.read, 1);
  assert.equal(calls.request, 1);
  assert.equal(store.getSnapshot().phase, 'allowed');
  await store.start();
  assert.equal(calls.request, 1);
});

test('denying the prompt shows the blocking screen; foreground checks never reprompt', async () => {
  const { store, calls } = harness();
  await store.start();
  assert.equal(store.getSnapshot().phase, 'blocked');
  assert.equal(calls.request, 1);
  await store.refresh();
  await store.refresh();
  assert.equal(calls.request, 1);
  assert.equal(store.getSnapshot().phase, 'blocked');
});

test('permanent denial does not try to display a forbidden system prompt', async () => {
  const { store, calls } = harness(denied);
  await store.start();
  assert.equal(calls.request, 0);
  await store.openSettings();
  assert.equal(calls.settings, 1);
  assert.equal(store.getSnapshot().phase, 'blocked', 'Opening Settings alone must never fake a grant');
});

test('returning from Settings proceeds only after the OS reports a grant', async () => {
  const { store, setPermission } = harness(denied);
  await store.start();
  await store.openSettings();
  await store.refresh();
  assert.equal(store.getSnapshot().phase, 'blocked');
  setPermission(granted);
  await store.refresh();
  assert.equal(store.getSnapshot().phase, 'allowed');
});

test('Allow rechecks a stale gate before opening Settings', async () => {
  const { store, setPermission, calls } = harness(denied);
  await store.start();
  setPermission(granted);
  await store.openSettings();
  assert.equal(store.getSnapshot().phase, 'allowed');
  assert.equal(calls.settings, 0);
});

test('explicit Allow can grant the project permission without reopening Settings', async () => {
  const { store, setPermission, calls } = harness(denied, granted);
  await store.start();
  setPermission(askable);
  await store.openSettings();
  assert.equal(calls.request, 1);
  assert.equal(calls.settings, 0);
  assert.equal(store.getSnapshot().phase, 'allowed');
});

test('permission revocation on a later foreground check restores the blocking screen', async () => {
  const { store, setPermission } = harness(granted);
  await store.start();
  setPermission(denied);
  await store.refresh();
  assert.equal(store.getSnapshot().phase, 'blocked');
});

test('fast Settings returns queue a fresh check instead of losing the grant', async () => {
  const { store, adapter, calls, setPermission } = harness(denied);
  let finish;
  adapter.openSettings = () => { calls.settings++; return new Promise(resolve => { finish = resolve; }); };
  await store.start();
  const opening = store.openSettings();
  await tick();
  const duplicate = store.openSettings();
  assert.equal(calls.settings, 1);
  setPermission(granted);
  const refresh = store.refresh();
  finish();
  await Promise.all([opening, duplicate, refresh]);
  await tick();
  assert.equal(store.getSnapshot().phase, 'allowed');
});

test('failed permission reads and requests fail closed and support a real retry', async () => {
  for (const method of ['read', 'request']) {
    const { adapter } = harness(askable, granted);
    const original = adapter[method];
    adapter[method] = async () => { throw Error('OS unavailable'); };
    const store = createNotificationPermissionStore(adapter);
    await store.start();
    assert.equal(store.getSnapshot().phase, 'blocked');
    assert.match(store.getSnapshot().error, /Could not check/);
    assert.equal(store.getSnapshot().busy, false);
    adapter[method] = original;
    await store.retry();
    assert.equal(store.getSnapshot().phase, 'allowed');
    assert.equal(store.getSnapshot().error, null);
  }
});

test('Settings failure is visible and can be retried without granting permission', async () => {
  const { store, adapter } = harness(denied);
  await store.start();
  adapter.openSettings = async () => { throw Error('Unavailable'); };
  await store.openSettings();
  assert.match(store.getSnapshot().error, /Could not open Settings/);
  assert.equal(store.getSnapshot().phase, 'blocked');
  adapter.openSettings = async () => {};
  await store.openSettings();
  assert.equal(store.getSnapshot().error, null);
  assert.equal(store.getSnapshot().phase, 'blocked');
});

test('browser adapter bypasses the mobile gate without calling any notification or Settings API', async () => {
  const { notificationAdapter } = load('adapter.web.ts');
  assert.equal(notificationAdapter.enabled, false);
  const store = createNotificationPermissionStore(notificationAdapter);
  assert.equal(store.getSnapshot().phase, 'allowed');
  await store.start();
  await store.refresh();
  await store.openSettings();
  assert.equal(store.getSnapshot().error, null);
});

test('permission state is reread on each app launch and never persisted as a fake grant', async () => {
  const { adapter, setPermission } = harness(granted);
  await createNotificationPermissionStore(adapter).start();
  setPermission(denied);
  const nextLaunch = createNotificationPermissionStore(adapter);
  await nextLaunch.start();
  assert.equal(nextLaunch.getSnapshot().phase, 'blocked');
  const source = fs.readFileSync(new URL('../components/notification-permission/model.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /AsyncStorage|localStorage|setItem/);
});

function nativeAdapter(platform, response) {
  const calls = [];
  let requestOptions;
  const { notificationAdapter } = load('adapter.ts', {
    'react-native': { Platform: { OS: platform }, Linking: { openSettings: async () => { calls.push('settings'); } } },
    'expo-notifications': {
      IosAuthorizationStatus: { PROVISIONAL: 3 }, AndroidImportance: { DEFAULT: 3 },
      getPermissionsAsync: async () => response,
      setNotificationChannelAsync: async (id, settings) => { assert.equal(id, 'default'); assert.equal(settings.name, 'AtherChain'); calls.push('channel'); },
      requestPermissionsAsync: async options => { calls.push('request'); requestOptions = options; return response; },
    },
  });
  return { notificationAdapter, calls, options: () => requestOptions };
}
test('Android creates its channel before requesting the real notification permission', async () => {
  const { notificationAdapter, calls } = nativeAdapter('android', granted);
  await notificationAdapter.request();
  assert.equal(calls.join(','), 'channel,request');
  await notificationAdapter.openSettings();
  assert.equal(calls.at(-1), 'settings');
});
test('iOS accepts provisional permission and requests alerts, badges and sounds without an Android channel', async () => {
  const { notificationAdapter, calls, options } = nativeAdapter('ios', { ...denied, ios: { status: 3 } });
  assert.equal((await notificationAdapter.read()).granted, true);
  await notificationAdapter.request();
  assert.equal(calls.join(','), 'request');
  assert.equal(options().ios.allowAlert, true);
  assert.equal(options().ios.allowBadge, true);
  assert.equal(options().ios.allowSound, true);
});

test('gate listens for Settings return and never mounts the entry flow while blocked', () => {
  for (const enabled of [true, false]) {
    const effects = [], listeners = {};
    let removed = 0, starts = 0, refreshes = 0, settings = 0;
    const store = {
      getSnapshot: () => ({ phase: enabled ? 'blocked' : 'allowed', busy: false, error: null }),
      subscribe: () => () => {}, start: async () => { starts++; },
      refresh: async () => { refreshes++; }, openSettings: async () => { settings++; }, retry: async () => {},
    };
    const { NotificationPermissionGate } = load('NotificationPermissionGate.tsx', {
      react: {
        createElement: (type, props) => ({ type, props }), useMemo: factory => factory(),
        useSyncExternalStore: (_, snapshot) => snapshot(), useEffect: callback => { effects.push(callback); },
      },
      'react-native': { AppState: { currentState: 'active', addEventListener: (event, callback) => { listeners[event] = callback; return { remove: () => { removed++; } }; } } },
      './adapter': { notificationAdapter: { enabled } }, './model': { createNotificationPermissionStore: () => store },
      './NotificationPermissionScreen': { NotificationPermissionScreen: 'NotificationPermissionScreen' },
    });
    const rendered = NotificationPermissionGate({ children: 'normal-entry' });
    const cleanups = effects.map(effect => effect());
    if (enabled) {
      assert.equal(rendered.type, 'NotificationPermissionScreen');
      rendered.props.onAllow();
      assert.equal(settings, 1);
      listeners.change('background'); listeners.change('active'); listeners.change('active');
      listeners.focus();
      assert.equal(refreshes, 3, 'Every resume or Android focus must read the OS permission');
      assert.equal(starts, 1);
      cleanups.forEach(cleanup => cleanup?.()); assert.equal(removed, 2);
    } else {
      assert.equal(rendered, 'normal-entry');
      assert.equal(starts, 0); assert.equal(listeners.change, undefined);
    }
  }
});

test('native gate wraps the unchanged onboarding/session routing and is configured for native builds', () => {
  const layout = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /<NotificationPermissionGate required=\{REQUIRE_NOTIFICATION_PERMISSION\}><RootLayoutNav \/><\/NotificationPermissionGate>/);
  assert.match(layout, /const REQUIRE_NOTIFICATION_PERMISSION = false;/);
  assert.match(layout, /guard=\{!entry.entered\}/);
  assert.match(layout, /guard=\{entry.entered\}/);
  const config = JSON.parse(fs.readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  assert.ok(config.expo.plugins.includes('expo-notifications'));
});

test('temporary native skip bypasses all OS permission, Settings and lifecycle work without removing the gate', () => {
  const effects = [];
  const { NotificationPermissionGate } = load('NotificationPermissionGate.tsx', {
    react: {
      createElement: (type, props) => ({ type, props }), useMemo: factory => factory(),
      useSyncExternalStore: (_, snapshot) => snapshot(), useEffect: effect => effects.push(effect),
    },
    'react-native': { AppState: { addEventListener: () => assert.fail('No lifecycle listeners while skipped') } },
    './adapter': { notificationAdapter: {
      enabled: true, read: () => assert.fail('No permission read'), request: () => assert.fail('No OS popup'),
      openSettings: () => assert.fail('No Settings redirect'),
    } },
    './model': { createNotificationPermissionStore },
    './NotificationPermissionScreen': { NotificationPermissionScreen: 'NotificationPermissionScreen' },
  }, { setInterval: () => assert.fail('No polling while skipped') });
  assert.equal(NotificationPermissionGate({ children: 'normal-entry', required: false }), 'normal-entry');
  effects.forEach(effect => assert.equal(effect(), undefined));
});

test('blocked gate rereads delayed permission updates only while active and cleans up its timer', () => {
  for (const phase of ['checking', 'blocked', 'allowed']) {
    const effects = [];
    let poll, refreshes = 0, cleared = false;
    const appState = { currentState: 'active', addEventListener: () => ({ remove() {} }) };
    const store = {
      subscribe: () => () => {},
      getSnapshot: () => ({ phase, busy: false, error: null }),
      start: async () => {}, refresh: async () => { refreshes++; },
    };
    const { NotificationPermissionGate } = load('NotificationPermissionGate.tsx', {
      react: {
        createElement: (type, props) => ({ type, props }), useMemo: factory => factory(),
        useSyncExternalStore: (_, snapshot) => snapshot(), useEffect: effect => effects.push(effect),
      },
      'react-native': { AppState: appState },
      './adapter': { notificationAdapter: { enabled: true } },
      './model': { createNotificationPermissionStore: () => store },
      './NotificationPermissionScreen': { NotificationPermissionScreen: 'NotificationPermissionScreen' },
    }, {
      setInterval: (callback, delay) => { poll = callback; assert.equal(delay, 1500); return 42; },
      clearInterval: timer => { assert.equal(timer, 42); cleared = true; },
    });
    NotificationPermissionGate({ children: 'normal-entry' });
    const cleanups = effects.map(effect => effect());
    if (phase === 'blocked') {
      poll(); assert.equal(refreshes, 1);
      appState.currentState = 'background';
      poll(); assert.equal(refreshes, 1);
      appState.currentState = 'active';
      poll(); assert.equal(refreshes, 2);
    } else assert.equal(poll, undefined);
    cleanups.forEach(cleanup => cleanup?.());
    assert.equal(cleared, phase === 'blocked');
  }
});

test('notification artwork reuses the complete onboarding illustration with a bell icon', () => {
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const { NotificationIllustration } = load('NotificationIllustration.tsx', {
    react,
    '@/components/kyc/Illustration': { IdentityIllustration: 'IdentityIllustration' },
  });
  const artwork = NotificationIllustration();
  assert.equal(artwork.type, 'IdentityIllustration');
  assert.equal(artwork.props.icon, 'bell');
  assert.equal(artwork.props.size, undefined, 'Keep onboarding’s default proportions');
  const welcome = fs.readFileSync(new URL('../components/onboarding/WelcomeScreen.tsx', import.meta.url), 'utf8');
  assert.match(welcome, /<IdentityIllustration icon="shield" \/>/);
});

test('screen provides the vector illustration, Settings action and visible retry without a skip path', () => {
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const dependencies = {
    react,
    'react-native': Object.fromEntries(['ActivityIndicator', 'Pressable', 'ScrollView', 'StatusBar', 'Text', 'View'].map(name => [name, name])),
    '@/hooks/useColors': { useColors: () => ({ walletInk: '#111111' }) },
    '@/hooks/useTheme': { useTheme: () => ({ scheme: 'light' }) },
    '@/components/kyc/parts': { PrimaryButton: 'PrimaryButton' },
    '@/components/onboarding/Shell': { WRAP: { width: '100%', maxWidth: 560 }, useInsets: () => ({ top: 24, bottom: 24 }) },
    './NotificationIllustration': { NotificationIllustration: 'NotificationIllustration' },
  };
  dependencies['react-native'].StyleSheet = { create: styles => styles };
  const { NotificationPermissionScreen } = load('NotificationPermissionScreen.tsx', dependencies);
  for (const phase of ['checking', 'blocked']) {
    let settings = 0, retries = 0;
    const tree = NotificationPermissionScreen({
      state: { phase, busy: false, error: 'Could not check permission' },
      onAllow: () => { settings++; }, onRetry: () => { retries++; },
    });
    const nodes = [];
    const visit = node => {
      if (Array.isArray(node)) return node.forEach(visit);
      if (!node || typeof node !== 'object') return;
      nodes.push(node); visit(node.props?.children);
    };
    visit(tree);
    assert.ok(nodes.some(node => node.type === 'NotificationIllustration'));
    const button = nodes.find(node => node.props.testID === 'notification-permission-allow');
    assert.equal(button.props.label, 'Allow Notifications');
    assert.equal(button.props.disabled, phase === 'checking');
    button.props.onPress(); assert.equal(settings, 1);
    nodes.find(node => node.props.testID === 'notification-permission-retry').props.onPress();
    assert.equal(retries, 1);
    assert.equal(nodes.some(node => node.props.children?.includes('Skip')), false);
    assert.ok(nodes.some(node => node.props.accessibilityRole === 'alert'));
  }
});
