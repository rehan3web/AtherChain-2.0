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
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in deps, `Unexpected import: ${name}`);
    return deps[name];
  } });
  return exports;
}

function profileStore(storage) {
  return load('../components/settings/profile.ts', {
    react: { useSyncExternalStore: (subscribe, snapshot) => { subscribe(() => {}); return snapshot(); } },
    '@react-native-async-storage/async-storage': storage,
    '@/components/wallet': { DEFAULT_USER: { name: 'Ana' } },
  });
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('profile validates names and usernames, and normalizes display values', () => {
  const store = profileStore({ getItem: async () => null });
  assert.equal(store.normalizeProfile({ name: '  Ana   Khan ', username: ' @Ana.Khan ' }).name, 'Ana Khan');
  assert.equal(store.normalizeProfile({ name: 'Ana', username: '@Ana.Khan' }).username, 'ana.khan');
  assert.ok(store.validateProfile({ name: ' ', username: 'ab' }).name);
  assert.ok(store.validateProfile({ name: 'Ana', username: 'bad user' }).username);
  assert.equal(Object.keys(store.validateProfile({ name: 'Ana', username: 'ana_khan' })).length, 0);
});

test('saved profile restores on a fresh app instance', async () => {
  let raw = null;
  const storage = { getItem: async () => raw, setItem: async (_, value) => { raw = value; } };
  const first = profileStore(storage);
  first.useProfile();
  await tick();
  await first.saveProfile({ name: '  New Name ', username: '@NEW_USER' });
  assert.equal(first.useProfile().profile.name, 'New Name');
  assert.deepEqual(JSON.parse(raw), { name: 'New Name', username: 'new_user' });
  const restored = profileStore(storage);
  restored.useProfile();
  await tick();
  assert.equal(restored.useProfile().profile.username, 'new_user');
});

test('storage failures and invalid saved profiles are visible, not successful saves', async () => {
  const failed = profileStore({ getItem: async () => { throw Error(); }, setItem: async () => { throw Error(); } });
  failed.useProfile();
  await tick();
  assert.match(failed.useProfile().error, /Could not read/);
  await assert.rejects(failed.saveProfile({ name: 'Changed', username: 'changed' }), /Could not save/);
  assert.equal(failed.useProfile().profile.name, 'Ana');
  const corrupt = profileStore({ getItem: async () => '{"name":"","username":"x"}' });
  corrupt.useProfile();
  await tick();
  assert.match(corrupt.useProfile().error, /invalid/);
});

test('every settings row opens its intended panel and logout confirms or cancels', async () => {
  const states = [];
  const routes = [];
  let logoutCalls = 0;
  let failLogout = true;
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in states)) states[i] = initial;
      return [states[i], next => { states[i] = next; }];
    },
  };
  const { SettingsScreen } = load('../components/settings/SettingsScreen.tsx', {
    react,
    'react-native': { Platform: { OS: 'ios' }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-router': { router: { push: route => routes.push(route) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/wallet/Sheet': { Sheet: 'Sheet' },
    '@/components/navigation/GlassDock': { useDockClearance: () => ({ clearance: 100 }) },
    './profile': { useProfile: () => ({ profile: { name: 'Ana', username: 'ana' }, loading: false, error: null }) },
    './ProfileForm': { ProfileForm: 'ProfileForm' },
    './InfoDetail': { INFO: {}, InfoDetail: 'InfoDetail' },
    './AppearancePanel': { AppearancePanel: 'AppearancePanel' },
    '@/components/kyc/parts': { PrimaryButton: 'PrimaryButton' },
    '@/components/onboarding/session': { logoutDemo: async () => {
      logoutCalls++;
      if (failLogout) throw new Error('Could not save entry preference.');
    } },
  });
  const render = () => { cursor = 0; return SettingsScreen(); };
  function find(node, predicate) {
    if (!node || typeof node !== 'object') return undefined;
    if (predicate(node)) return node;
    return (node.props?.children ?? []).flat(Infinity).map(child => find(child, predicate)).find(Boolean);
  }
  for (const [id, panel] of Object.entries({
    personal: 'edit', appearance: 'appearance',
    logout: 'logout',
  })) {
    const tree = render();
    find(tree, node => node.props?.testID === `settings-row-${id}`).props.onPress();
    assert.equal(states[0], panel);
    assert.notEqual(find(render(), node => node.type === 'Sheet').props.fullScreen, true);
    find(render(), node => node.type === 'Sheet').props.onClose();
    assert.equal(states[0], null);
  }
  find(render(), node => node.props?.testID === 'settings-edit-profile').props.onPress();
  assert.equal(states[0], 'edit');
  const avatar = find(render(), node => node.props?.testID === 'settings-gradient-avatar');
  assert.equal(avatar.type, 'LinearGradient');
  assert.equal(avatar.props.colors.join(','), '#f69a27,#db5380,#b700d6');
  assert.equal(avatar.props.style.width, 64);
  find(render(), node => node.props?.testID === 'settings-row-kyc').props.onPress();
  find(render(), node => node.props?.testID === 'settings-row-sessions').props.onPress();
  find(render(), node => node.props?.testID === 'settings-row-2fa').props.onPress();
  find(render(), node => node.props?.testID === 'settings-row-passkey').props.onPress();
  find(render(), node => node.props?.testID === 'settings-row-password').props.onPress();
  assert.deepEqual(routes, ['/kyc', '/sessions', '/twofa', '/passkeys', '/change-password']);
  assert.equal(find(render(), node => node.props?.testID === 'settings-profile').props.style.flexDirection, 'row');
  const details = find(render(), node => node.props?.testID === 'settings-profile-details');
  assert.ok(find(details, node => node.props?.testID === 'settings-profile-name'));
  assert.ok(find(details, node => node.props?.testID === 'settings-profile-username'));
  assert.equal(find(render(), node => node.props?.testID === 'settings-invite'), undefined);
  assert.equal(find(render(), node => node.props?.testID === 'settings-help'), undefined);
  assert.equal(find(render(), node => node.props?.hint !== undefined), undefined);
  find(render(), node => node.props?.testID === 'settings-row-logout').props.onPress();
  find(render(), node => node.props?.testID === 'settings-logout-cancel').props.onPress();
  assert.equal(logoutCalls, 0);
  find(render(), node => node.props?.testID === 'settings-row-logout').props.onPress();
  find(render(), node => node.props?.testID === 'settings-logout-confirm').props.onPress();
  await tick();
  assert.equal(logoutCalls, 1);
  assert.ok(find(render(), node => node.props?.testID === 'settings-logout-error'));
  failLogout = false;
  find(render(), node => node.props?.testID === 'settings-logout-confirm').props.onPress();
  await tick();
  assert.equal(logoutCalls, 2);
  assert.equal(find(render(), node => node.props?.testID === 'settings-logout-error'), undefined);
});

test('Settings replaces the profile dock and the old route redirects', () => {
  const nav = fs.readFileSync(new URL('../components/navigation/GlassDock.tsx', import.meta.url), 'utf8');
  assert.match(nav, /settings: \{ label: 'Settings', icon: 'settings' \}/);
  assert.doesNotMatch(nav, /you: \{ label:/);
  const old = fs.readFileSync(new URL('../app/(tabs)/you.tsx', import.meta.url), 'utf8');
  assert.match(old, /Redirect href=.*\/settings/);
});

test('bottom navigation has four tabs and no Files page or icon', () => {
  const nav = fs.readFileSync(new URL('../components/navigation/GlassDock.tsx', import.meta.url), 'utf8');
  const layout = fs.readFileSync(new URL('../app/(tabs)/_layout.tsx', import.meta.url), 'utf8');
  assert.deepEqual([...nav.matchAll(/^  (\w+): \{ label:/gm)].map(m => m[1]), ['index', 'wallet', 'search', 'settings']);
  assert.doesNotMatch(layout, /name="files"|dock-files/);
  assert.equal(fs.existsSync(new URL('../app/(tabs)/files.tsx', import.meta.url)), false);
});

test('personal information edits only the name, keeps username, validates and saves', async () => {
  const states = [];
  let cursor = 0;
  let closed = 0;
  let fail = false;
  const saved = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in states)) states[i] = initial;
      return [states[i], next => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    useRef: initial => {
      const i = cursor++;
      states[i] ??= { current: initial };
      return states[i];
    },
  };
  const store = profileStore({ getItem: async () => null });
  const { ProfileForm } = load('../components/settings/ProfileForm.tsx', {
    react,
    'react-native': Object.fromEntries(['ActivityIndicator', 'Pressable', 'Text', 'TextInput', 'View'].map(x => [x, x])),
    '@/hooks/useColors': { useColors: () => ({}) },
    './profile': {
      validateProfile: store.validateProfile,
      saveProfile: async value => { if (fail) throw Error('Storage failed'); saved.push(value); },
    },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] :
    [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  const render = () => {
    cursor = 0;
    return ProfileForm({ initial: { name: 'Ana', username: 'unchanged_user' }, onDone: () => closed++ });
  };
  const byId = id => nodes(render()).find(node => node.props?.testID === id);
  assert.equal(byId('profile-username-input'), undefined);
  assert.equal(byId('profile-form-cancel'), undefined);
  assert.equal(byId('profile-form').props.style.flex, undefined, 'Name form stays compact in the bottom sheet');
  assert.equal(nodes(render()).filter(node => node.type === 'TextInput').length, 1);
  byId('profile-name-input').props.onChangeText(' ');
  await byId('profile-form-save').props.onPress();
  assert.ok(byId('profile-name-input-error'));
  assert.equal(saved.length, 0);
  byId('profile-name-input').props.onChangeText('New Name');
  fail = true;
  await byId('profile-form-save').props.onPress();
  assert.ok(byId('profile-form-error'));
  assert.equal(closed, 0);
  fail = false;
  await byId('profile-form-save').props.onPress();
  assert.equal(saved[0].name, 'New Name');
  assert.equal(saved[0].username, 'unchanged_user');
  assert.equal(closed, 1);
});

test('bottom sheets stay in keyboard-avoiding layout instead of pinning beneath the keyboard', () => {
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => [initial, () => {}],
    useRef: initial => ({ current: initial }),
    useEffect: () => {},
  };
  const { Sheet } = load('../components/wallet/Sheet.tsx', {
    react,
    'react-native': {
      Animated: { Value: class { constructor(value) { this.value = value; } }, View: 'AnimatedView' },
      Dimensions: { get: () => ({ height: 800 }) },
      Modal: 'Modal', PanResponder: { create: () => ({ panHandlers: {} }) },
      Platform: { OS: 'android' }, Pressable: 'Pressable', ScrollView: 'ScrollView',
      StyleSheet: { create: styles => styles, absoluteFill: { position: 'absolute' } },
      Text: 'Text', View: 'View',
    },
    '@expo/vector-icons': { Feather: 'Feather' },
    'react-native-keyboard-controller': { KeyboardAvoidingView: 'KeyboardAvoidingView' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 24 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    './primitives': { useReducedMotion: () => true },
    '@/components/toast/ToastProvider': { ToastSurface: 'ToastSurface' },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] :
    [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  for (const fullScreen of [false, true]) {
    const tree = Sheet({ open: true, title: 'Personal Information', fullScreen,
      onClose() {}, onExited() {}, children: 'Form' });
    const avoiding = nodes(tree).find(node => node.type === 'KeyboardAvoidingView');
    assert.equal(avoiding.props.behavior, 'padding');
    const anchor = avoiding.props.children.find(node => node.type === 'View');
    assert.equal(anchor.props.style.flex, 1);
    assert.equal(anchor.props.style.minHeight, 0);
    assert.equal(anchor.props.style.position, undefined);
    assert.equal(anchor.props.children[0].props.style[0].flexShrink, 1);
    assert.equal(nodes(tree).find(node => node.type === 'ScrollView').props.keyboardShouldPersistTaps, 'handled');
  }
});

test('appearance boxes select each mode, show errors and block writes while saving', () => {
  const calls = [];
  const theme = { preference: 'system', ready: true, saving: false, error: null,
    setTheme: async mode => { calls.push(mode); theme.preference = mode; } };
  const react = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const palette = { background: '#ffffff', walletInk: '#18181b' };
  const { AppearancePanel } = load('../components/settings/AppearancePanel.tsx', {
    react,
    'react-native': { ActivityIndicator: 'ActivityIndicator', Pressable: 'Pressable', Text: 'Text', View: 'View' },
    '@expo/vector-icons': { Feather: 'Feather' },
    '@/hooks/useColors': { useColors: () => palette },
    '@/hooks/useTheme': { useTheme: () => theme },
    '@/constants/colors': { light: palette, dark: palette },
  });
  const nodes = node => !node || typeof node !== 'object' ? [] :
    [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  const find = id => nodes(AppearancePanel()).find(node => node.props?.testID === id);
  assert.equal(find('appearance-system').props.accessibilityState.checked, true);
  for (const mode of ['light', 'dark', 'system']) {
    find(`appearance-${mode}`).props.onPress();
    assert.equal(theme.preference, mode);
    assert.equal(find(`appearance-${mode}`).props.accessibilityState.checked, true);
  }
  assert.deepEqual(calls, ['light', 'dark', 'system']);
  theme.saving = true;
  assert.equal(find('appearance-light').props.disabled, true);
  find('appearance-light').props.onPress();
  assert.equal(calls.length, 3);
  assert.ok(find('appearance-saving'));
  theme.saving = false;
  theme.error = 'Could not save your theme';
  assert.equal(find('appearance-error').props.accessibilityRole, 'alert');
});
