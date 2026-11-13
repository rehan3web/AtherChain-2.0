import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

export function load(file, deps = {}, globals = {}) {
  const exports = {};
  let cache;
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require(name) {
    if (!(name in deps) && (name === '@/services/cache' || name === './cache')) {
      cache ??= load('../services/cache.ts', {}, globals);
      return cache;
    }
    assert.ok(name in deps, `Unexpected dependency ${name}`); return deps[name]; },
    setTimeout, clearTimeout, ...globals });
  return exports;
}
export function hooks() {
  let cursor = 0, tree, effects = [];
  const slots = [], timers = new Map(), motions = [];
  let sequence = 0;
  const react = {
    Fragment: 'Fragment', forwardRef: fn => fn,
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i]))
        slots[index] = { deps, callback: fn };
      return slots[index].callback;
    },
    useEffect(fn, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || !deps || deps.some((value, i) => value !== previous.deps?.[i])) {
        effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; });
      }
    },
  };
  const native = { View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable',
    ActivityIndicator: 'Spinner', ScrollView: 'ScrollView', Platform: { OS: 'web' },
    Keyboard: { dismiss() {} }, AppState: { addEventListener: () => ({ remove() {} }) },
    BackHandler: { addEventListener: () => ({ remove() {} }) },
    Animated: { Value: class {}, View: 'AnimatedView', timing: (_value, config) => { motions.push(config.toValue); return {}; }, sequence: () => ({ start() {} }) },
    StyleSheet: { create: styles => styles },
  };
  return { react, native, motions,
    setTimeout(fn) { const id = ++sequence; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    tick() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    render(fn) { cursor = 0; effects = []; tree = fn(); effects.forEach(fn => fn()); return tree; },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
export function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.footer)];
}
export const byId = (tree, id) => nodes(tree).find(node => node.props?.testID === id);
export const byType = (tree, type) => nodes(tree).find(node => node.type === type);
export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
