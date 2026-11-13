import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load, hooks, byId, byType, nodes, deferred } from './auth-test-utils.mjs';

const stateDependency = { '@/components/BackendScreenState': { BackendScreenState: 'BackendScreenState' } };
const recipient = load('../components/wallet/recipient.ts');
const transactions = load('../services/transactions.ts', {
  './api': { transactionApi: {} }, '@/components/wallet/recipient': recipient,
});
const baseTransaction = { id: 'fixture-id', timestamp: '2026-11-12T12:00:00Z', txHash: 'fixture-hash',
  type: 'send', amount: '2.50', status: 'completed', fromAddress: 'ATH_SENDER', toAddress: 'ATH_RECEIVER' };

for (const [method, value] of [['username', '@alice'], ['email', 'alice@example.test'],
  ['address', `ATH_${'a'.repeat(40)}`]]) {
  test(`history receipts retain the saved ${method} recipient`, () => {
    const item = { ...baseTransaction, metadata: { recipient: { method, value } } };
    const tx = transactions.walletTransaction(item);
    const receipt = transactions.backendReceipt(item);
    assert.equal(tx.recipient.method, method);
    assert.equal(receipt.recipient.value, value);
    assert.equal(receipt.methodLabel, undefined);
    assert.equal(receipt.amount, 2.5);
  });
}
test('legacy history uses its real address, and incoming history never shows the sender-only recipient', () => {
  const legacy = transactions.backendReceipt(baseTransaction);
  assert.equal(legacy.recipient.method, 'address');
  assert.equal(legacy.recipient.value, 'ATH_RECEIVER');
  const incoming = transactions.backendReceipt({ ...baseTransaction, type: 'receive',
    metadata: { recipient: { method: 'username', value: '@receiver' } } });
  assert.equal(incoming.recipient.value, 'ATH_SENDER');
});

function resourceHarness(h) {
  let loader;
  const resource = { data: null, loading: true, error: null, async reload() {
    resource.loading = true; resource.error = null;
    try { resource.data = await loader(); }
    catch (error) { resource.data = null; resource.error = error.message; }
    finally { resource.loading = false; }
  } };
  return { resource, dependency: { useBackendResource: fn => { loader = fn; return resource; } } };
}
test('wallet waits for stats and history before mounting a finite balance', async () => {
  const h = hooks(), r = resourceHarness(h), response = deferred();
  const { Wallet } = load('../components/wallet/Wallet.tsx', {
    ...stateDependency, react: h.react, './MoneyCard': { MoneyCard: 'MoneyCard' },
    './recipient': recipient, 'expo-router': { router: {} },
    '@/services/api': { ApiError: Error, walletApi: { stats: () => response.promise } },
    '@/services/transactions': { getAllTransactions: async () => [], walletTransaction: transactions.walletTransaction },
    '@/hooks/useBackendResource': r.dependency, '@/services/refresh': { refreshBackendData() {} },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast() {} }) },
  });
  assert.ok(byId(h.render(Wallet), 'wallet-loading'));
  const pending = r.resource.reload();
  assert.equal(byType(h.render(Wallet), 'MoneyCard'), undefined);
  response.resolve({ ath_balance: '123.45' }); await pending;
  assert.equal(byType(h.render(Wallet), 'MoneyCard').props.balance, 123.45);
});
test('swap displays loading until both backend balance and rate arrive, with retry on failure', async () => {
  const h = hooks(), r = resourceHarness(h), profile = deferred(), rate = deferred();
  h.native.useWindowDimensions = () => ({ height: 874 });
  const coins = load('../components/wallet/swap-model.ts');
  const { SwapSheet } = load('../components/wallet/SwapSheet.tsx', {
    ...stateDependency, react: h.react, 'react-native': h.native,
    '@expo/vector-icons': { Feather: 'Feather' }, '@/hooks/useColors': { useColors: () => ({}) },
    '@/services/api': { swapApi: { rate: () => rate.promise }, userApi: { me: () => profile.promise } },
    '@/hooks/useBackendResource': r.dependency, '@/services/refresh': { refreshBackendData() {} },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast() {} }) },
    './primitives': { ScalePressable: 'Pressable', useReducedMotion: () => true },
    './SlideConfirm': { SlideConfirm: 'SlideConfirm' }, './AtherLogo': { AtherLogo: 'Logo' },
    './swap-model': coins, './NumericKeypad': { NumericKeypad: 'Keypad' },
    './format': { showRaw: raw => raw || '0', useMoney: () => ({ num: value => value.toFixed(2) }) },
  });
  const render = () => h.render(() => SwapSheet({ balance: 999, onReviewChange() {}, onReceipt() {} }));
  assert.ok(byId(render(), 'wallet-swap-loading'));
  const pending = r.resource.reload();
  rate.resolve({ rate: '1.5', active: true }); await Promise.resolve();
  assert.ok(byId(render(), 'wallet-swap-loading'));
  assert.equal(byId(render(), 'wallet-swap-error'), undefined);
  profile.resolve({ at_balance: '25' }); await pending;
  assert.ok(byId(render(), 'wallet-swap-entry'));
  assert.match(byId(render(), 'wallet-swap-limit').props.children.join(''), /Available 25\.00 AT/);
  r.resource.data = null; r.resource.error = 'Server unavailable';
  assert.equal(byId(render(), 'wallet-swap-loading').props.error, 'Server unavailable');
});
test('transactions show loading and errors instead of an early empty or demo list', () => {
  const h = hooks();
  const resource = { loading: true, error: null, items: [], reload() {} };
  const { TransactionHistoryScreen } = load('../components/activity/TransactionHistoryScreen.tsx', {
    ...stateDependency, react: h.react, 'react-native': h.native,
    '@expo/vector-icons': { Feather: 'Feather' }, 'expo-router': { router: {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/wallet/SendReceipt': { SendReceipt: 'SendReceipt' },
    '@/components/wallet/SwapReceipt': { SwapReceipt: 'SwapReceipt' },
    './store': { useTransactionActivityResource: () => resource }, './receiptMoney': {},
  });
  assert.ok(byId(h.render(TransactionHistoryScreen), 'transactions-loading'));
  resource.loading = false; resource.error = 'History unavailable';
  assert.equal(byId(h.render(TransactionHistoryScreen), 'transactions-loading').props.error, 'History unavailable');
  resource.error = null;
  assert.ok(byId(h.render(TransactionHistoryScreen), 'transactions-list'));
  assert.doesNotMatch(fs.readFileSync(new URL('../components/activity/TransactionHistoryScreen.tsx', import.meta.url), 'utf8'), /Demo activity|This app session/);
});
test('send errors remain in the toast, not repeated above the confirmation slider', () => {
  const h = hooks();
  const { SendConfirmation } = load('../components/wallet/SendConfirmation.tsx', {
    react: h.react, 'react-native': h.native, '@expo/vector-icons': { Feather: 'Feather' },
    '@/hooks/useColors': { useColors: () => ({}) }, './SlideConfirm': { SlideConfirm: 'SlideConfirm' },
  });
  const tree = SendConfirmation({ draft: { recipient: { method: 'username', value: '@alice' }, amount: 2 },
    money: { full: String }, error: 'Insufficient funds', attempt: 1, status: 'idle', onConfirm() {} });
  assert.equal(byId(tree, 'wallet-send-confirm-error'), undefined);
  assert.ok(byId(tree, 'wallet-send-slider'));
  assert.equal(nodes(tree).some(n => n.props.children?.includes('Insufficient funds')), false);
});
test('swap receipt omits network fee while retaining swap fee', () => {
  const source = fs.readFileSync(new URL('../components/wallet/SwapReceipt.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /label="Network fee"/);
  assert.match(source, /label="Swap fee"/);
});
test('balance animation never initializes or animates with NaN and recovers to the fetched amount', () => {
  const h = hooks(), targets = [];
  class Value {
    constructor(value) { assert.ok(Number.isFinite(value)); }
    addListener() { return 'listener'; }
    removeListener() {}
    stopAnimation() {}
    setValue(value) { assert.ok(Number.isFinite(value)); targets.push(value); }
  }
  h.native.AccessibilityInfo = { isReduceMotionEnabled: async () => false, addEventListener: () => ({ remove() {} }) };
  h.native.Easing = { bezier: () => () => 0 };
  h.native.Animated = {
    Value, createAnimatedComponent: component => component,
    timing: (_value, { toValue }) => {
      assert.ok(Number.isFinite(toValue)); targets.push(toValue);
      return { start: fn => fn({ finished: true }), stop() {} };
    },
  };
  const { AnimatedAmount } = load('../components/wallet/primitives.tsx', {
    react: h.react, 'react-native': h.native,
    '@/components/toast/ToastContext': {}, '@expo/vector-icons': {},
    'expo-linear-gradient': {}, '@/utils/clipboard': {}, '@/hooks/useColors': {},
  });
  let amount = Number.NaN;
  const render = () => h.render(() => AnimatedAmount({ value: amount, format: value => value.toFixed(2) }));
  assert.deepEqual(render().props.children, ['—']);
  amount = 123.45; render();
  assert.deepEqual(render().props.children, ['123.45']);
  amount = 150; render();
  assert.deepEqual(render().props.children, ['150.00']);
  assert.ok(targets.includes(123.45));
  assert.ok(targets.includes(150));
});
