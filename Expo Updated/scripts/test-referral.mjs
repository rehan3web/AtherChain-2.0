import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness({ platform = 'web', share, copy, history = false } = {}) {
  const notices = [];
  const routes = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef: value => ({ current: value }),
    useState: value => [value, () => {}],
    useEffect() {},
  };
  const dependencies = {
    react,
    'react-native': {
      Platform: { OS: platform }, Pressable: 'Pressable', ScrollView: 'ScrollView',
      Text: 'Text', View: 'View', Share: { share, sharedAction: 'sharedAction' },
      StyleSheet: { create: value => value, hairlineWidth: 1 },
    },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: {
      canGoBack: () => history,
      back: () => routes.push('back'),
      replace: path => routes.push(path),
    } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    'react-native-svg': { default: 'Svg', Circle: 'Circle', Path: 'Path', Rect: 'Rect', __esModule: true },
    '@/hooks/useColors': { useColors: () => ({ walletBlue: [] }) },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: notice => notices.push(notice) }) },
    '@/utils/clipboard': { copyText: copy ?? (async () => {}) },
    '@/services/api': { referralApi: { stats() {} } },
    '@/hooks/useBackendResource': { useBackendResource: () => ({ data: {
      referralCode: '93q74093', referralLink: 'https://example.test/register?ref=93q74093',
      totalReferrals: 15, config: { unverifiedReward: 5, verifiedReward: 10 },
      referrals: Array.from({ length: 15 }, (_, index) => ({ kyc_status: index < 10 ? 'approved' : 'unverified' })),
    }, error: null }) },
  };
  const source = fs.readFileSync(new URL('../components/referral/ReferralScreen.tsx', import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  const nodes = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node.type === 'function') return visit(node.type(node.props));
    nodes.push(node);
    visit(node.props?.children);
  }
  visit(exports.ReferralScreen());
  return { notices, routes, nodes, button: id => nodes.find(node => node.props.testID === id).props };
}

test('shows backend-configured rewards, referral counts and referral code', () => {
  const app = harness();
  const labels = app.nodes.map(node => node.props.accessibilityLabel);
  for (const label of ['Sign Up Reward: 5 AT', 'KYC Reward: 10 AT', 'Unverified\nReferrals: 5', 'Verified\nReferrals: 10', 'Total\nReferrals: 15']) {
    assert.ok(labels.includes(label), label);
  }
  assert.equal(app.button('referral-code').children[0], '93q74093');
  assert.equal(app.nodes.some(node => node.props.children?.includes('Preview figures — nothing has been credited')), false);
});

test('explains automatic sign-up credit after first mining and separate approved KYC reward', () => {
  const app = harness();
  const text = app.button('referral-reward-conditions').children.join('');
  assert.match(text, /automatically credited after your referred friend mines for the first time/);
  assert.match(text, /not when they create an account/);
  assert.match(text, /KYC reward is separate/);
  assert.match(text, /KYC is approved/);
});

test('centers the scrollable content and keeps the invite in a separate bottom bar', () => {
  const app = harness();
  const scroll = app.nodes.find(node => node.type === 'ScrollView');
  assert.equal(scroll.props.contentContainerStyle.justifyContent, 'center');
  assert.equal(scroll.props.contentContainerStyle.alignItems, 'center');
  const footer = app.button('referral-bottom-bar');
  assert.equal(footer.children[0].props.testID, 'referral-invite');
  assert.equal(scroll.props.children.some(node => node?.props?.testID === 'referral-invite'), false);
  const row = app.button('referral-code-row');
  assert.equal(row.style[0].justifyContent, 'space-between');
  assert.equal(row.style[0].alignItems, 'center');
  assert.equal(row.style[0].paddingVertical, 16);
  assert.equal(row.style[0].borderBottomWidth, 0.5);
  const copyStyles = Object.assign({}, ...app.button('referral-copy-code').style({ pressed: false }));
  assert.equal(copyStyles.backgroundColor, undefined);
  assert.equal(copyStyles.borderRadius, undefined);
  assert.equal(scroll.props.children.at(-1).props.testID, 'referral-code-row');
});

test('code copy copies only the exact referral code on web and native', async () => {
  for (const platform of ['web', 'android', 'ios']) {
    let copied;
    const app = harness({ platform, copy: async text => { copied = text; } });
    await app.button('referral-copy-code').onPress();
    assert.equal(copied, '93q74093');
    assert.equal(app.notices[0].title, 'Referral code copied');
  }
});

test('code copy failures are reported and retry succeeds', async () => {
  let attempts = 0;
  const app = harness({ copy: async () => { if (++attempts === 1) throw Error('Denied'); } });
  await app.button('referral-copy-code').onPress();
  assert.equal(app.notices[0].kind, 'error');
  await app.button('referral-copy-code').onPress();
  assert.equal(app.notices[1].title, 'Referral code copied');
});

test('code copy blocks duplicate taps until the current copy finishes', async () => {
  let finish, calls = 0;
  const app = harness({ copy: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  const first = app.button('referral-copy-code').onPress();
  await app.button('referral-copy-code').onPress();
  assert.equal(calls, 1);
  finish();
  await first;
  const second = app.button('referral-copy-code').onPress();
  assert.equal(calls, 2);
  finish();
  await second;
});

test('web invite copies an invitation and confirms success', async () => {
  let copied;
  const app = harness({ copy: async text => { copied = text; } });
  await app.button('referral-invite').onPress();
  assert.match(copied, /AtherChain/);
  assert.equal(app.notices[0].title, 'Invitation copied');
});

test('failed copy is reported and can be retried', async () => {
  let attempts = 0;
  const app = harness({ copy: async () => { if (++attempts === 1) throw Error('Denied'); } });
  await app.button('referral-invite').onPress();
  assert.equal(app.notices[0].kind, 'error');
  await app.button('referral-invite').onPress();
  assert.equal(app.notices[1].kind, 'success');
});

test('native cancellation is not reported as success', async () => {
  const app = harness({ platform: 'ios', share: async () => ({ action: 'dismissedAction' }) });
  await app.button('referral-invite').onPress();
  assert.equal(app.notices.length, 0);
});

test('native share blocks duplicate taps and confirms an actual share', async () => {
  let finish;
  let calls = 0;
  const app = harness({ platform: 'android', share: () => {
    calls++;
    return new Promise(resolve => { finish = resolve; });
  } });
  const first = app.button('referral-invite').onPress();
  await app.button('referral-invite').onPress();
  assert.equal(calls, 1);
  finish({ action: 'sharedAction' });
  await first;
  assert.equal(app.notices[0].kind, 'success');
});

test('back returns to the previous screen or home on a direct visit', () => {
  for (const history of [false, true]) {
    const app = harness({ history });
    app.button('referral-back').onPress();
    assert.deepEqual(app.routes, [history ? 'back' : '/']);
  }
});
