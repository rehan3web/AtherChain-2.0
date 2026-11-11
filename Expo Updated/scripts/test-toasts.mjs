import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const exports = {};
const code = ts.transpileModule(fs.readFileSync(new URL('../components/toast/toast-model.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(code, { exports });
const { addToast, removeToast, registerHost, activeHost, TOAST_DURATION } = exports;
const item = (id, title = `Toast ${id}`, kind = 'success') => ({ id, title, kind, expiresAt: 1000 + TOAST_DURATION });

test('notifications are newest first and bounded to three', () => {
  let queue = [];
  for (let id = 1; id <= 5; id++) queue = addToast(queue, item(id));
  assert.equal(queue.length, 3);
  assert.equal(queue.map(toast => toast.id).join(','), '5,4,3');
});
test('repeated feedback replaces rather than duplicates the same notification', () => {
  const queue = addToast([item(1, 'Try again')], item(2, 'Try again'));
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, 2);
});
test('success and error messages are not mistaken for duplicates', () => {
  const queue = addToast([item(1, 'Copy', 'error')], item(2, 'Copy', 'success'));
  assert.equal(queue.length, 2);
});
test('distinct message details are retained', () => {
  const queue = addToast([{ ...item(1, 'Ticket created'), body: 'AT-1' }], { ...item(2, 'Ticket created'), body: 'AT-2' });
  assert.equal(queue.length, 2);
});
test('dismissal only removes its own item, without changing deadlines', () => {
  const queue = [item(1), item(2)];
  const next = removeToast(queue, 1);
  assert.equal(next.length, 1);
  assert.equal(next[0].expiresAt, queue[1].expiresAt);
  assert.equal(queue.length, 2);
});
test('the latest modal hosts notifications, then falls back through underlying windows', () => {
  let hosts = registerHost([], 'sheet');
  hosts = registerHost(hosts, 'receipt');
  assert.equal(activeHost(hosts), 'receipt');
  hosts = hosts.filter(host => host !== 'receipt');
  assert.equal(activeHost(hosts), 'sheet');
  assert.equal(activeHost([]), 'root');
});
test('re-registering a host never produces duplicate surfaces', () => {
  const hosts = registerHost(registerHost([], 'sheet'), 'sheet');
  assert.equal(hosts.length, 1);
});
test('automatic expiry has a finite six-second deadline', () => {
  assert.equal(TOAST_DURATION, 6000);
});

test('root keeps the old Referral top position while modal toasts have extra safe-top clearance', () => {
  for (const [os, inset, modal, expected] of [
    ['web', 0, false, 79], ['ios', 59, false, 71], ['android', 24, false, 36],
    ['web', 0, true, 91], ['ios', 59, true, 83], ['android', 24, true, 72], ['android', 0, true, 72],
  ]) {
    const deps = {
      react: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useState: v => [v, () => {}], useEffect() {} },
      'react-native': { Platform: { OS: os }, View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: x => x, hairlineWidth: 1 } },
      '@expo/vector-icons': {},
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: inset, bottom: 34 }) },
      'react-native-reanimated': {},
      '@/hooks/useColors': {},
      '@/components/wallet/primitives': {},
      '@/components/wallet/ConfirmedIcon': {},
    };
    const module = {};
    const compiled = ts.transpileModule(fs.readFileSync(new URL('../components/toast/ToastStack.tsx', import.meta.url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
    }).outputText;
    vm.runInNewContext(compiled, { exports: module, require: name => {
      assert.ok(name in deps, `Unexpected dependency ${name}`); return deps[name];
    } });
    const tree = module.ToastStack({ toasts: [item(1)], modal, onDismiss() {}, onPauseChange() {} });
    const anchor = Object.assign({}, ...tree.props.style);
    assert.equal(tree.props.testID, 'global-toast-anchor');
    assert.equal(anchor.top, expected);
    assert.equal(anchor.bottom, undefined);
  }
});
