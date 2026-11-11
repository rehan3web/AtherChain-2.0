import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(permission = { granted: false, canAskAgain: true }) {
  const state = [], refs = [], effects = [], timers = new Map(), navigation = [];
  let cursor = 0, refCursor = 0, effectCursor = 0, id = 0, onAppState, blur, permissions = 0, dirty = false;
  const pending = [];
  const requestPermission = async () => { permissions++; return { granted: false, canAskAgain: true }; };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], value => {
        const next = typeof value === 'function' ? value(state[i]) : value;
        if (next !== state[i]) { state[i] = next; dirty = true; }
      }];
    },
    useRef: value => refs[refCursor++] ?? (refs[refCursor - 1] = { current: value }),
    useCallback: fn => fn,
    useEffect: (fn, deps) => {
      const i = effectCursor++;
      if (!effects[i] || deps.some((value, n) => value !== effects[i].deps[n])) {
        pending.push(() => { effects[i]?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  const animation = () => ({ start() {}, stop() {} });
  const deps = {
    react,
    'react-native': {
      AccessibilityInfo: { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }), announceForAccessibility() {} },
      Animated: { Value: class { setValue() {} interpolate() { return 0; } }, loop: animation, sequence: animation, timing: animation, View: 'AnimatedView' },
      AppState: { currentState: 'active', addEventListener: (_, fn) => { onAppState = fn; return { remove() {} }; } },
      Easing: { inOut: v => v, quad: 1 }, Pressable: 'Pressable', Text: 'Text', View: 'View',
      StyleSheet: { create: v => v, absoluteFill: {}, hairlineWidth: 1 },
    },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-camera': { CameraView: 'CameraView', useCameraPermissions: () => [permission, requestPermission] },
    'expo-router': { useRouter: () => ({ canGoBack: () => true, back: () => navigation.push('back'), replace: p => navigation.push(p) }),
      useFocusEffect: fn => { if (!blur) blur = fn(); } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  };
  const code = ts.transpileModule(fs.readFileSync(new URL('../components/scan/ScanLoginScreen.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { assert.ok(name in deps, name); return deps[name]; },
    setTimeout: (fn, ms) => { assert.equal(ms, 2000); timers.set(++id, fn); return id; }, clearTimeout: key => timers.delete(key) });
  const nodes = node => !node || typeof node !== 'object' ? [] : [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  const render = () => {
    let tree;
    do {
      dirty = false;
      cursor = refCursor = effectCursor = 0;
      tree = exports.ScanLoginScreen();
      pending.splice(0).forEach(fn => fn());
    } while (dirty);
    return tree;
  };
  render();
  const cleanup = () => effects.forEach(effect => effect.cleanup?.());
  const byId = key => nodes(render()).find(n => n.props.testID === key);
  return { byId, navigation, timers, cleanup, blur: () => { blur(); render(); }, background: () => { onAppState('background'); render(); },
    foreground: () => { onAppState('active'); render(); },
    get permissions() { return permissions; },
    press: key => byId(key).props.onPress(),
    finish: () => { for (const [key, fn] of [...timers]) { timers.delete(key); fn(); } } };
}

test('scanner starts automatically for exactly 2000ms without a login button', () => {
  const app = harness();
  assert.ok(app.byId('scan-screen'));
  assert.equal(app.permissions, 1);
  assert.equal(app.byId('scan-login'), undefined);
  assert.equal(app.byId('scan-enable-camera'), undefined);
  assert.equal(app.timers.size, 1);
  app.finish();
  assert.ok(app.byId('scan-success'));
  assert.equal(app.byId('scan-login'), undefined);
  app.press('scan-done');
  assert.deepEqual(app.navigation, ['back']);
});

test('back, blur, background and unmount cancel pending completion', () => {
  for (const action of ['back', 'blur', 'background', 'cleanup']) {
    const app = harness();
    if (action === 'back') app.press('scan-back'); else app[action]();
    app.finish();
    assert.equal(app.byId('scan-success'), undefined, action);
  }
});

test('full-screen camera is automatic when allowed; denied access still completes dummy flow', async () => {
  for (const permission of [{ granted: true }, { granted: false, canAskAgain: false }]) {
    const app = harness(permission);
    assert.equal(!!app.byId('scan-camera'), permission.granted);
    assert.equal(app.permissions, 0);
    app.finish();
    assert.ok(app.byId('scan-success'));
    assert.equal(app.byId('scan-camera'), undefined);
  }
});

test('foreground starts a fresh timer and stale callbacks cannot complete a cancelled scan', () => {
  const app = harness();
  const stale = [...app.timers.values()][0];
  app.background();
  stale();
  assert.equal(app.byId('scan-success'), undefined);
  app.foreground();
  assert.equal(app.timers.size, 1);
  app.finish();
  assert.ok(app.byId('scan-success'));
});

test('dashboard scanner opens standalone registered route', () => {
  const dashboard = fs.readFileSync(new URL('../components/dashboard/DashboardScreen.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /next === 'scan'.*router\.push\('\/scan'\)/);
  const layout = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /Stack.Screen name="scan"/);
});
