import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

test('system bar icons, navigator and native root backgrounds follow the selected theme', async () => {
  let scheme = 'dark';
  const backgrounds = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useEffect: effect => { effect(); },
  };
  const Stack = Object.assign(() => {}, { Screen: 'Screen', Protected: 'Protected' });
  const deps = {
    react,
    'react-native': { Platform: { OS: 'android' }, StatusBar: 'StatusBar' },
    '@tanstack/react-query': { QueryClient: class {}, QueryClientProvider: 'QueryClientProvider' },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureHandlerRootView' },
    'react-native-keyboard-controller': { KeyboardProvider: 'KeyboardProvider' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider' },
    '@/components/ErrorBoundary': { ErrorBoundary: 'ErrorBoundary' },
    '@expo-google-fonts/dm-sans': { useFonts: () => [true, null] },
    'expo-router': { Stack },
    'expo-splash-screen': { preventAutoHideAsync() {}, hideAsync() {} },
    'expo-system-ui': { setBackgroundColorAsync: async color => { backgrounds.push(color); } },
    '@/hooks/useTheme': { ThemeProvider: 'ThemeProvider', useTheme: () => ({ scheme, ready: true }) },
    '@/hooks/useColors': { useColors: () => ({ background: scheme === 'dark' ? '#171717' : '#ffffff' }) },
    '@/components/toast/ToastProvider': { ToastProvider: 'ToastProvider', useToast: () => ({ showToast() {} }) },
    '@/components/onboarding/session': { loadDemoSession: async () => {}, useDemoSession: () => ({ ready: true, entered: true }) },
    '@/components/notification-permission/NotificationPermissionGate': { NotificationPermissionGate: 'NotificationPermissionGate' },
  };
  const source = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source + '\nexport { RootLayoutNav, ThemedApp };', {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in deps, `Unexpected import ${name}`);
    return deps[name];
  } });
  const nodes = node => !node || typeof node !== 'object' ? [] :
    [node, ...(node.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  for (const mode of ['dark', 'light']) {
    scheme = mode;
    const tree = nodes(exports.RootLayoutNav());
    const bar = tree.find(node => node.type === 'StatusBar');
    assert.equal(bar.props.barStyle, mode === 'dark' ? 'light-content' : 'dark-content');
    const nav = tree.find(node => node.type === Stack);
    assert.equal(nav.props.screenOptions.statusBarStyle, mode === 'dark' ? 'light' : 'dark');
    const expected = mode === 'dark' ? '#171717' : '#ffffff';
    assert.equal(backgrounds.at(-1), expected);
    const roots = nodes(exports.ThemedApp());
    const gate = roots.find(node => node.type === 'NotificationPermissionGate');
    assert.equal(gate.props.required, false);
    assert.equal(gate.props.children[0].type, exports.RootLayoutNav);
    for (const type of ['SafeAreaProvider', 'GestureHandlerRootView']) {
      assert.equal(roots.find(node => node.type === type).props.style.backgroundColor, expected);
    }
  }
});
