import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected import: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const model = load('../components/wallet/swap-model.ts');
const colors = load('../constants/colors.ts').default;
const [at, ath] = model.SWAP_COINS;
function nodes(tree) {
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...nodes(tree.props.children)];
}
function text(tree) {
  if (Array.isArray(tree)) return tree.map(text).join(' ');
  if (tree && typeof tree === 'object') return text(tree.props.children);
  return tree == null || typeof tree === 'boolean' ? '' : String(tree);
}
function harness(scheme = 'dark') {
  let cursor = 0, effects = [], state = [];
  const recorded = [], timers = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }];
    },
    useRef(current) {
      const i = cursor++;
      if (!(i in state)) state[i] = { current };
      return state[i];
    },
    useEffect: callback => effects.push(callback),
    useCallback: fn => fn,
    useMemo: fn => fn(),
  };
  const native = Object.fromEntries(['View', 'Text', 'Pressable', 'Modal', 'ScrollView'].map(n => [n, n]));
  native.Platform = { OS: 'web' };
  native.useWindowDimensions = () => ({ height: 874, width: 402 });
  native.StyleSheet = { create: s => s, hairlineWidth: 1 };
  native.Animated = {
    View: 'AnimatedView',
    Value: class { interpolate() { return 0; } setValue() {} },
    spring: () => ({ start() {} }), timing: () => ({ start() {} }),
  };
  const common = {
    react, 'react-native': native, '@expo/vector-icons': { Feather: 'Feather' },
    'expo-image': { Image: 'Image' },
    '@/hooks/useTheme': { useTheme: () => ({ scheme }) },
    '@/hooks/useColors': { useColors: () => colors[scheme] },
    '@/components/toast/ToastProvider': { ToastSurface: 'ToastSurface', useToast: () => ({ showToast() {} }) },
    './swap-model': model,
  };
  const logo = load('../components/wallet/AtherLogo.tsx', {
    ...common,
    '../../assets/images/ather-logo-black.svg': { uri: 'ather-logo-black.svg' },
    '../../assets/images/ather-logo-white.svg': { uri: 'ather-logo-white.svg' },
  });
  const swap = load('../components/wallet/SwapSheet.tsx', {
    ...common, './AtherLogo': logo,
    './format': load('../components/wallet/format.ts', { react }),
    './NumericKeypad': { NumericKeypad: 'NumericKeypad' },
    './primitives': { ScalePressable: 'ScalePressable', useReducedMotion: () => true },
    './SlideConfirm': { SlideConfirm: 'SlideConfirm' },
    '@/components/activity/store': { recordActivity: item => recorded.push(item) },
  }, { setTimeout: callback => timers.push(callback), clearTimeout() {} });
  const receipt = load('../components/wallet/SwapReceipt.tsx', {
    ...common, './SwapSheet': swap, './ConfirmedIcon': { ConfirmedIcon: 'ConfirmedIcon' },
    '@/utils/clipboard': { copyText: async () => {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
  });
  const expand = tree => {
    if (Array.isArray(tree)) return tree.map(expand);
    if (!tree || typeof tree !== 'object') return tree;
    if (typeof tree.type === 'function') return expand(tree.type(tree.props));
    return { ...tree, props: { ...tree.props, children: expand(tree.props.children) } };
  };
  let tree;
  return {
    logo, swap, receipt, recorded, timers,
    render(Component, props = {}) {
      cursor = 0; effects = [];
      tree = expand(Component(props));
      effects.forEach(effect => effect());
      return tree;
    },
    find: id => nodes(tree).find(node => node.props.testID === id),
    byType: type => nodes(tree).find(node => node.type === type),
  };
}

test('fixed AT to ATH quote uses the actual amount at exact 1:1 with no fee', () => {
  assert.equal(Array.from(model.SWAP_COINS, c => c.sym).join(','), 'AT,ATH');
  for (const amount of [0, 0.01, 1, 2.5, 52002.5]) {
    const quote = model.swapQuote(at, ath, amount);
    assert.equal(quote.amount, amount);
    assert.equal(quote.receiveAmount, amount);
    assert.equal(quote.feeAmount, 0);
    assert.equal(quote.fee, 0);
  }
  assert.throws(() => model.swapQuote(ath, at, 1), /Only AT to ATH/);
  for (const amount of [-1, NaN, Infinity]) assert.throws(() => model.swapQuote(at, ath, amount), /valid swap amount/);
});

for (const [scheme, fill] of [['dark', 'white'], ['light', 'black']]) {
  test(`supplied exact transparent SVG is used for both tokens in ${scheme} mode`, () => {
    const app = harness(scheme);
    const source = fs.readFileSync(new URL(`../attached_assets/${fill === 'black' ? 'Black_1794324298742' : 'White_1794324298744'}.svg`, import.meta.url), 'utf8');
    const svg = fs.readFileSync(new URL(`../assets/images/ather-logo-${fill}.svg`, import.meta.url), 'utf8');
    assert.equal(svg.trim(), source.trim());
    const pngOriginal = fill === 'black' ? 'Black_1794324298743' : 'White_1794324298742';
    assert.deepEqual(fs.readFileSync(new URL(`../assets/images/ather-logo-${fill}.png`, import.meta.url)),
      fs.readFileSync(new URL(`../attached_assets/${pngOriginal}.png`, import.meta.url)));
    for (const coin of [at, ath]) {
      const tree = app.render(app.swap.CoinLogo, { coin, size: 56 });
      const image = nodes(tree).find(node => node.type === 'Image');
      assert.equal(image.props.source.uri, `ather-logo-${fill}.svg`);
      assert.match(svg, new RegExp(`fill="${fill}"`));
      assert.match(svg, /viewBox="0 0 1024 898"/);
      assert.equal(image.props.contentFit, 'contain');
      assert.ok(Math.abs(image.props.style.width / image.props.style.height - 1024 / 898) < 1e-9);
      assert.doesNotMatch(svg, /<rect|<image/);
    }
  });
}

test('swap keeps the shared keypad width and lowers the amount fields without changing the keys', () => {
  const app = harness();
  app.render(app.swap.SwapSheet, { balance: 100, onReviewChange() {}, onReceipt() {} });
  const entry = app.find('wallet-swap-entry').props.style[0];
  assert.equal(entry.maxWidth, 512);
  assert.equal(entry.width, '100%');
  assert.equal(entry.alignSelf, 'center');
  const fields = app.find('wallet-swap-fields').props.style[0];
  assert.equal(fields.flexGrow, 1);
  assert.equal(fields.flexShrink, 0);
  assert.equal(fields.justifyContent, 'center');
  assert.equal(fields.paddingVertical, 24);
  const keypad = app.byType('NumericKeypad');
  assert.equal(keypad.props.testIDPrefix, 'wallet-swap-key');
  assert.notEqual(keypad.props.hideDecimal, true);
});

for (const scheme of ['light', 'dark']) {
  test(`larger Swap fields separate token headers from amount rows and contrast Max in ${scheme} mode`, () => {
    const app = harness(scheme);
    app.render(app.swap.SwapSheet, { balance: 52002.5, onReviewChange() {}, onReceipt() {} });
    const style = node => Object.assign({}, ...[node.props.style].flat(Infinity).filter(Boolean));
    for (const [side, index] of [['pay', 0], ['receive', 1]]) {
      const header = app.find(`wallet-swap-${side}-header`);
      const row = app.find(`wallet-swap-${side}-amount-row`);
      assert.ok(nodes(header).some(node => node.props.testID === `wallet-swap-token-${index}`));
      assert.ok(!nodes(header).some(node => node.props.testID === `wallet-swap-amount-${index}`));
      assert.ok(nodes(row).some(node => node.props.testID === `wallet-swap-amount-${index}`));
      assert.ok(style(app.find(`wallet-swap-${side}-field`)).minHeight >= 144);
      assert.equal(style(row).gap, 20);
    }
    assert.equal(style(app.find('wallet-swap-max')).backgroundColor, colors[scheme].walletInk);
    assert.equal(style(app.find('wallet-swap-max-label')).color, colors[scheme].walletOnInk);
    assert.equal(style(app.find('wallet-swap-max')).height, 44);
  });
}

test('keypad edits AT only, Max uses the available practice amount, and review records the entered 1:1 quote', () => {
  const app = harness();
  const props = { balance: 52002.5, onReviewChange() {}, onReceipt() {} };
  let tree = app.render(app.swap.SwapSheet, props);
  assert.equal(text(app.find('wallet-swap-token-0')).trim(), 'AT');
  assert.equal(text(app.find('wallet-swap-token-1')).trim(), 'ATH');
  assert.doesNotMatch(text(tree), /\$|BTC|HYPE/);
  assert.equal(app.find('wallet-swap-token-0').props.onPress, undefined);
  assert.equal(app.find('wallet-swap-token-1').props.onPress, undefined);
  assert.equal(app.find('wallet-swap-select-0'), undefined);
  assert.equal(app.find('wallet-swap-reverse'), undefined);
  assert.equal(app.find('wallet-swap-coin-AT'), undefined);
  assert.equal(app.find('wallet-swap-review').props.disabled, true);
  app.byType('NumericKeypad').props.onKey('2');
  app.render(app.swap.SwapSheet, props);
  app.byType('NumericKeypad').props.onKey('.');
  app.render(app.swap.SwapSheet, props);
  app.byType('NumericKeypad').props.onKey('5');
  app.render(app.swap.SwapSheet, props);
  assert.match(text(app.find('wallet-swap-amount-0')), /2\.5/);
  assert.match(text(app.find('wallet-swap-amount-1')), /2\.5/);
  app.find('wallet-swap-max').props.onPress();
  app.render(app.swap.SwapSheet, props);
  assert.match(text(app.find('wallet-swap-amount-0')), /52002\.5/);
  app.byType('NumericKeypad').props.onClear();
  app.render(app.swap.SwapSheet, props);
  app.byType('NumericKeypad').props.onKey('2');
  app.render(app.swap.SwapSheet, props);
  app.find('wallet-swap-review').props.onPress();
  tree = app.render(app.swap.SwapSheet, props);
  assert.match(text(tree), /AT to ATH/);
  assert.match(text(app.find('wallet-swap-review-pay')), /2 AT/);
  assert.match(text(app.find('wallet-swap-review-receive')), /2 ATH/);
  assert.match(text(app.find('wallet-swap-review-fee')), /0 AT/);
  assert.doesNotMatch(text(tree), /\$|BTC|HYPE/);
  app.byType('SlideConfirm').props.onConfirm();
  app.render(app.swap.SwapSheet, props);
  assert.equal(app.recorded[0].title, 'AT to ATH');
  assert.equal(app.recorded[0].receipt.data.pay.sym, 'AT');
  assert.equal(app.recorded[0].receipt.data.receive.sym, 'ATH');
  assert.equal(app.recorded[0].receipt.data.quote.amount, 2);
  assert.equal(app.recorded[0].receipt.data.quote.receiveAmount, 2);
});

test('zero, unavailable and over-limit swap amounts cannot open review; delete/clear recover', () => {
  for (const balance of [0, NaN, 1]) {
    const app = harness(), props = { balance, onReviewChange() {}, onReceipt() {} };
    app.render(app.swap.SwapSheet, props);
    assert.equal(app.find('wallet-swap-review').props.disabled, true);
    app.byType('NumericKeypad').props.onKey('2');
    app.render(app.swap.SwapSheet, props);
    assert.equal(app.find('wallet-swap-review').props.disabled, true);
    assert.ok(app.find('wallet-swap-error'));
    app.find('wallet-swap-review').props.onPress();
    app.render(app.swap.SwapSheet, props);
    assert.ok(app.find('wallet-swap-entry'));
    app.byType('NumericKeypad').props.onKey('del');
    app.render(app.swap.SwapSheet, props);
    assert.equal(app.find('wallet-swap-review').props.disabled, true);
  }
});

test('receipt matches pay/receive amounts and token fee, including older quotes without feeAmount', () => {
  for (const legacy of [false, true]) {
    const app = harness(), quote = model.swapQuote(at, ath, 2.5);
    if (legacy) delete quote.feeAmount;
    const tree = app.render(app.receipt.SwapReceipt, {
      receipt: { reference: 'test', createdAt: 'Nov 10, 2026', pay: at, receive: ath, quote },
      onClose() {},
    });
    assert.match(text(app.find('wallet-receipt-pay')), /2\.5 AT/);
    assert.match(text(app.find('wallet-receipt-receive')), new RegExp(`${model.swapUnits(quote.receiveAmount, ath)} ATH`));
    assert.match(text(app.find('wallet-receipt-fee')), /0 AT/);
    assert.doesNotMatch(text(tree), /\$|BTC|HYPE/);
    assert.equal(nodes(tree).some(node => node.type === 'ScrollView'), true);
  }
});
