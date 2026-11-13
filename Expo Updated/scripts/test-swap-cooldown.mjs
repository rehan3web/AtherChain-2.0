import test from 'node:test';
import assert from 'node:assert/strict';
import { load, hooks, byId, byType } from './auth-test-utils.mjs';

function fixture({ seconds = 3661, enabled = true } = {}) {
  const h = hooks(), timers = new Map();
  let now = Date.parse('2026-11-13T12:00:00Z'), loader, reloads = 0;
  class Clock extends Date { static now() { return now; } }
  const profile = { at_balance: '100', next_swap_at: new Date(now + seconds * 1000).toISOString() };
  const resource = { data: null, loading: true, error: null, async reload() {
    reloads++; resource.loading = true;
    resource.data = await loader(); resource.loading = false;
  } };
  h.native.useWindowDimensions = () => ({ height: 874 });
  const coins = load('../components/wallet/swap-model.ts');
  const { SwapSheet } = load('../components/wallet/SwapSheet.tsx', {
    react: h.react, 'react-native': h.native, '@expo/vector-icons': { Feather: 'Feather' },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/services/api': { swapApi: { rate: async () => ({ rate: 1, active: true, cooldown_enabled: enabled }) },
      userApi: { me: async () => profile } },
    '@/hooks/useBackendResource': { useBackendResource: callback => { loader = callback; return resource; } },
    '@/services/refresh': { refreshBackendData() {} },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast() {} }) },
    '@/components/BackendScreenState': { BackendScreenState: 'BackendScreenState' },
    './primitives': { ScalePressable: 'Pressable', useReducedMotion: () => true },
    './SlideConfirm': { SlideConfirm: 'SlideConfirm' }, './AtherLogo': { AtherLogo: 'Logo' },
    './swap-model': coins, './NumericKeypad': { NumericKeypad: 'Keypad' },
    './format': { showRaw: raw => raw || '0', press: (_raw, key) => key,
      useMoney: () => ({ num: value => value.toFixed(2), decimal: '.' }) },
  }, { Date: Clock, setInterval: callback => { const id = Symbol(); timers.set(id, callback); return id; },
    clearInterval: id => timers.delete(id) });
  const render = () => h.render(() => SwapSheet({ balance: 0, onReviewChange() {}, onReceipt() {} }));
  render();
  return { h, render, resource, profile, timers, get reloads() { return reloads; },
    async start() { await resource.reload(); render(); return render(); },
    async advance(seconds) {
      now += seconds * 1000;
      for (const callback of [...timers.values()]) callback();
      for (let i = 0; i < 10; i++) await Promise.resolve();
      return render();
    } };
}

test('active cooldown leaves swap screen and keypad open with a disabled HH:MM:SS button', async () => {
  const app = fixture();
  let tree = await app.start();
  assert.ok(byId(tree, 'wallet-swap-entry'));
  assert.ok(byType(tree, 'Keypad'));
  assert.equal(byId(tree, 'wallet-swap-review').props.disabled, true);
  assert.equal(byId(tree, 'wallet-swap-review').props.accessibilityLabel, 'Cooldown 01:01:01');
  assert.deepEqual(byId(tree, 'wallet-swap-cooldown').props.children, ['Cooldown 01:01:01']);
  byType(tree, 'Keypad').props.onKey('5');
  tree = app.render();
  byId(tree, 'wallet-swap-review').props.onPress();
  assert.ok(byId(app.render(), 'wallet-swap-entry'));
  tree = await app.advance(1);
  assert.equal(byId(tree, 'wallet-swap-review').props.accessibilityLabel, 'Cooldown 01:01:00');
  app.h.unmount();
  assert.equal(app.timers.size, 0);
});
test('countdown expiration refreshes server data and restores Swap for a valid amount', async () => {
  const app = fixture({ seconds: 2 });
  let tree = await app.start();
  byType(tree, 'Keypad').props.onKey('5');
  tree = await app.advance(2);
  assert.equal(app.reloads, 2);
  assert.equal(byId(tree, 'wallet-swap-cooldown'), undefined);
  assert.equal(byId(tree, 'wallet-swap-review').props.accessibilityLabel, 'Swap');
  assert.equal(byId(tree, 'wallet-swap-review').props.disabled, false);
  assert.equal(app.timers.size, 0);
});
test('disabled server cooldown ignores a future next-swap timestamp', async () => {
  const app = fixture({ enabled: false });
  const tree = await app.start();
  assert.equal(byId(tree, 'wallet-swap-cooldown'), undefined);
  assert.equal(byId(tree, 'wallet-swap-review').props.accessibilityLabel, 'Swap');
  assert.equal(app.timers.size, 0);
});
test('expired cooldown does not create a timer or repeatedly refresh the backend', async () => {
  const app = fixture({ seconds: -60 });
  const tree = await app.start();
  assert.equal(byId(tree, 'wallet-swap-cooldown'), undefined);
  await app.advance(10);
  assert.equal(app.reloads, 1);
  assert.equal(app.timers.size, 0);
});
