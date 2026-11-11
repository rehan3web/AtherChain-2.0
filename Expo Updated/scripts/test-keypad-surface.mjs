import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const colors = load('../constants/colors.ts').default;
const react = {
  createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  useState: value => [value, () => {}],
  useRef: current => ({ current }),
  useEffect() {},
};
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props.children)];
}
const flatten = styles => Object.assign({}, ...styles.flat(Infinity).filter(Boolean));

for (const scheme of ['light', 'dark']) {
  test(`Swap uses Send Money's sheet surface and boxed keypad in ${scheme} mode`, () => {
    const c = colors[scheme];
    const native = {
      ...Object.fromEntries(['View', 'Text', 'Pressable', 'Modal', 'ScrollView'].map(name => [name, name])),
      StyleSheet: { create: styles => styles },
      Platform: { OS: 'android' },
      Keyboard: { dismiss() {} },
      Dimensions: { get: () => ({ height: 874, width: 402 }) },
      PanResponder: { create: () => ({ panHandlers: {} }) },
      Animated: { View: 'AnimatedView', Value: class {} },
    };
    const common = {
      react, 'react-native': native,
      '@expo/vector-icons': { Feather: 'Feather' },
      '@/hooks/useColors': { useColors: () => c },
    };
    const { Sheet } = load('../components/wallet/Sheet.tsx', {
      ...common,
      'react-native-keyboard-controller': { KeyboardAvoidingView: 'KeyboardAvoidingView' },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
      './primitives': { EASE_OUT: null, useReducedMotion: () => true },
      '@/components/toast/ToastProvider': { ToastSurface: 'ToastSurface' },
    });
    const surface = props => {
      const tree = Sheet({ open: true, title: 'Swap', onClose() {}, onExited() {}, ...props });
      return flatten(nodes(tree).find(node => node.props.testID === 'wallet-sheet-surface').props.style).backgroundColor;
    };
    const swapSurface = surface({ fullScreen: true, surface: 'sheet' });
    assert.equal(swapSurface, surface({ fullScreen: false }), 'Swap must match Send Money, not the grey full-page surface');
    assert.equal(surface({ fullScreen: true }), c.miningPage, 'Review screens must keep their original surface');
    const { NumericKeypad } = load('../components/wallet/NumericKeypad.tsx', {
      ...common, './format': { BACKSPACE: 'del' },
    });
    const keys = nodes(NumericKeypad({ onKey() {} })).filter(node => node.type === 'Pressable');
    assert.equal(keys.length, 12);
    for (const key of keys) {
      const style = flatten(key.props.style({ pressed: false }));
      assert.equal(style.backgroundColor, c.walletField);
      assert.notEqual(style.backgroundColor, swapSurface);
      assert.equal(style.height, 50);
      assert.equal(style.borderRadius, 16);
      assert.equal(flatten(key.props.style({ pressed: true })).backgroundColor, c.walletFieldPressed);
    }
  });
}
