import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, dependencies = {}) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected import ${name}`);
    return dependencies[name];
  } });
  return exports;
}

function store() {
  const mapper = load('../components/wallet/transactionReceipt.ts');
  return load('../components/activity/store.ts', {
    react: { useSyncExternalStore: (_, snapshot) => snapshot() },
    '@/components/wallet/transactionReceipt': mapper,
  });
}

function receipt(id, currency = 'USD') {
  return { type: 'send', currency, data: {
    amount: 2.123456, recipient: { method: 'username', value: 'testuser' },
    note: 'Test', reference: id, createdAt: 'Jan 1, 2026', demo: true,
  } };
}

test('all transactions remain in history, newest first, without duplicates or boosts', () => {
  const s = store();
  for (let i = 0; i < 125; i++) {
    s.recordActivity({ id: `txn-${i}`, title: `Payment ${i}`, timestamp: Date.now() + i,
      icon: 'arrow-up-right', value: '−$2.12', receipt: receipt(`ref-${i}`) });
  }
  s.recordActivity({ id: 'boost', title: 'Boost activated', timestamp: Date.now(), icon: 'zap', value: '1/3' });
  s.recordActivity({ id: 'txn-1', title: 'duplicate', timestamp: Date.now(), icon: 'zap', value: '0' });
  const items = s.useTransactionActivities();
  assert.equal(items.length, 126);
  assert.equal(items[0].id, 'txn-124');
  assert.equal(items.some(item => item.id === 'boost'), false);
  assert.equal(items.filter(item => item.id === 'txn-1').length, 1);
  assert.equal(items.find(item => item.id === 'txn-1').receipt.data.reference, 'ref-1');
});

test('sample and received receipts preserve amount, reference, direction and recipient', () => {
  const s = store();
  const sample = s.useTransactionActivities()[0].receipt.data;
  assert.equal(sample.amount, 60);
  assert.equal(sample.reference, 'demo-txn-t0');
  const { transactionReceipt } = load('../components/wallet/transactionReceipt.ts');
  const r = transactionReceipt({ id: 'in', title: 'Received', amount: 4.5, date: 0,
    recipient: { method: 'address', value: 'original-address' } }, 'en-US');
  assert.equal(r.direction, 'received');
  assert.equal(r.recipient.value, 'original-address');
  assert.equal(r.amount, 4.5);
});

test('a successful wallet send records the exact receipt returned to the confirmation screen', async () => {
  const recorded = [];
  const react = {
    createElement: (type, props) => ({ type, props }),
    useState: value => [typeof value === 'function' ? value() : value, () => {}],
  };
  const mapper = load('../components/wallet/transactionReceipt.ts');
  const source = fs.readFileSync(new URL('../components/wallet/Wallet.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const dependencies = {
    react, './defaults': { DEFAULT_CONTACTS: [], DEFAULT_USER: { name: 'Test' } },
    './format': { ...load('../components/wallet/format.ts', { react: {} }), uid: () => 'new-send' }, './primitives': { BallIcon: 'BallIcon' },
    './MoneyCard': { MoneyCard: 'MoneyCard' }, './recipient': { recipientError: () => null },
    './transactionReceipt': mapper, 'expo-router': { router: { push() {} } },
    '@/components/activity/store': {
      SAMPLE_PAYMENT: { id: 't0', title: 'Sample', timestamp: 0, amount: -60 },
      recordActivity: value => recorded.push(value),
    },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, setTimeout: callback => callback(), require: name => {
    assert.ok(name in dependencies, `Unexpected import ${name}`);
    return dependencies[name];
  } });
  const { onSend } = exports.Wallet().props;
  const result = await onSend({ amount: 12.34, note: 'Lunch',
    recipient: { method: 'email', value: 'friend@example.com' } });
  assert.equal(recorded.length, 1);
  assert.equal(recorded[0].receipt.data, result);
  assert.equal(recorded[0].receipt.currency, 'ATH');
  assert.equal(recorded[0].value, '−12.34 ATH');
  assert.equal(result.amount, 12.34);
  assert.equal(result.note, 'Lunch');
  assert.equal(result.recipient.value, 'friend@example.com');
  assert.equal(result.reference, 'demo-txn-new-send');
  await assert.rejects(() => onSend({ amount: 999999, note: '',
    recipient: { method: 'username', value: 'testuser' } }), /Insufficient/);
  assert.equal(recorded.length, 1);
});

test('token receipts use suffixes and retain their precision without changing wallet balance formatting', () => {
  const format = load('../components/wallet/format.ts', { react: {} });
  const { receiptMoney } = load('../components/activity/receiptMoney.ts', {
    '@/components/wallet/format': format,
  });
  assert.equal(receiptMoney('USD').full(60), '$60.00');
  assert.equal(receiptMoney('AT').full(0.000001), '0.000001 AT');
  assert.equal(receiptMoney('ATH').full(52002.5), '52002.50 ATH');
  assert.equal(receiptMoney('ATH').full(0), '0.00 ATH');
  assert.equal(receiptMoney('ATH').full(12.349), '12.35 ATH');
  assert.equal(receiptMoney('ATH').int(52002), '52002');
  assert.equal(format.makeMoney('invalid_locale', 'ATH').full(52002.5), 'ATH 52002.50');
});

test('wallet transaction list uses trailing ATH for visible and accessible amounts', () => {
  const format = load('../components/wallet/format.ts', { react: {} });
  const { ActivityList } = load('../components/wallet/ActivityList.tsx', {
    react: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    'react-native': { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: s => s } },
    '@expo/vector-icons': { Feather: 'Feather' },
    '@/hooks/useColors': { useColors: () => ({}) },
    './format': format, './primitives': { TxIcon: 'TxIcon' },
  });
  const tree = ActivityList({ transactions: [{ id: 'test', title: 'To friend', date: 0, amount: -2 }],
    money: format.makeMoney('en-US', 'ATH'), locale: 'en-US', onSelect() {} });
  assert.match(JSON.stringify(tree), /2\.00 ATH/);
  assert.doesNotMatch(JSON.stringify(tree), /ATH 2\.00/);
});

test('sent and received receipt summaries show only suffix amount and date, keeping recipient details below', () => {
  const format = load('../components/wallet/format.ts', { react: {} });
  for (const direction of ['sent', 'received']) for (const method of ['email', 'username']) {
    const value = method === 'email' ? 'friend@example.com' : 'friend';
    const { SendReceipt } = load('../components/wallet/SendReceipt.tsx', {
      react: {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
        useState: value => [value, () => {}],
      },
      'react-native': { Modal: 'Modal', Platform: { OS: 'web' }, Pressable: 'Pressable', ScrollView: 'ScrollView',
        Text: 'Text', View: 'View', StyleSheet: { create: s => s } },
      '@expo/vector-icons': { Feather: 'Feather' },
      '@/utils/clipboard': { copyText: async () => {} },
      'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
      '@/hooks/useColors': { useColors: () => ({}) },
      './ConfirmedIcon': { ConfirmedIcon: 'ConfirmedIcon' },
      './SendConfirmation': { SendDetail: 'SendDetail', SEND_METHOD_LABELS: { email: 'Email', username: 'Username' } },
      './format': format,
      '@/components/toast/ToastProvider': { ToastSurface: 'ToastSurface', useToast: () => ({ showToast() {} }) },
    });
    const tree = SendReceipt({ receipt: {
      ...receipt('ref', 'ATH').data, amount: 2, direction, createdAt: 'Nov 10, 2026',
      recipient: { method, value }, transactionTitle: `To ${value}`,
    }, money: format.makeMoney('en-US', 'ATH'), onClose() {} });
    const all = [];
    const walk = node => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (node && typeof node === 'object') { all.push(node); walk(node.props.children); }
    };
    walk(tree);
    assert.match(JSON.stringify(tree), /"type":"ScrollView"/);
    const summary = all.find(n => n.props.testID === 'wallet-send-receipt-summary');
    const summaryText = JSON.stringify(summary);
    assert.match(summaryText, /2\.00 ATH/);
    assert.match(summaryText, /Nov 10, 2026/);
    assert.doesNotMatch(summaryText, /To |friend/);
    const receiver = all.find(n => n.props.label === (direction === 'sent' ? 'Receiver' : 'Sender'));
    assert.equal(receiver.props.value, value);
    assert.equal(all.find(n => n.props.label === 'Amount').props.value, '2.00 ATH');
  }
});

function screen(items = []) {
  let selected = null;
  const routes = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: () => [selected, value => { selected = value; }],
  };
  const { TransactionHistoryScreen } = load('../components/activity/TransactionHistoryScreen.tsx', {
    react,
    'react-native': { FlatList: 'FlatList', Platform: { OS: 'web' }, Pressable: 'Pressable',
      Text: 'Text', View: 'View', StyleSheet: { create: value => value, hairlineWidth: 1 } },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: { canGoBack: () => false, replace: path => routes.push(path) } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/wallet/SendReceipt': { SendReceipt: 'SendReceipt' },
    '@/components/wallet/SwapReceipt': { SwapReceipt: 'SwapReceipt' },
    './store': { useTransactionActivities: () => items },
    './receiptMoney': { receiptMoney: currency => ({ currency }) },
  });
  function nodes() {
    const result = [];
    function visit(node) {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) return node.forEach(visit);
      if (typeof node.type === 'function') return visit(node.type(node.props));
      result.push(node);
      visit(node.props?.children);
      if (node.type === 'FlatList') {
        if (!node.props.data.length) visit(node.props.ListEmptyComponent);
        node.props.data.forEach(item => visit(node.props.renderItem({ item })));
      }
    }
    visit(TransactionHistoryScreen());
    return result;
  }
  return { nodes, routes };
}

test('tapping a payment uses the wallet receipt and closing restores the history', () => {
  const payment = { id: 'p1', title: 'Payment', timestamp: 0, icon: 'arrow-up-right', value: '$2', receipt: receipt('original-ref') };
  const app = screen([payment]);
  app.nodes().find(node => node.props.testID === 'txn-history-row-p1').props.onPress();
  const opened = app.nodes().find(node => node.type === 'SendReceipt');
  assert.equal(opened.props.receipt, payment.receipt.data);
  assert.equal(opened.props.money.currency, 'USD');
  opened.props.onClose();
  assert.equal(app.nodes().some(node => node.type === 'SendReceipt'), false);
});

test('swap transactions reopen the original swap receipt', () => {
  const swap = { id: 'swap', title: 'BTC to ETH', timestamp: 0, icon: 'repeat', value: '0.05 BTC',
    receipt: { type: 'swap', data: { reference: 'original-swap' } } };
  const app = screen([swap]);
  app.nodes().find(node => node.props.testID === 'txn-history-row-swap').props.onPress();
  assert.equal(app.nodes().find(node => node.type === 'SwapReceipt').props.receipt, swap.receipt.data);
});

test('empty history has a clear empty state and direct-entry back goes home', () => {
  const app = screen();
  assert.ok(app.nodes().some(node => node.props.testID === 'transactions-empty'));
  app.nodes().find(node => node.props.testID === 'transactions-back').props.onPress();
  assert.deepEqual(app.routes, ['/']);
});
