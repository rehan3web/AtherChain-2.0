import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === '@/services/cache') return load('../services/cache.ts', {});
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return exports;
}
function reactHarness() {
  let cursor = 0;
  const values = [];
  const react = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    },
    useEffect() {},
    useCallback: callback => callback,
  };
  return { react, render: callback => { cursor = 0; return callback(); } };
}
function find(tree, id) {
  if (Array.isArray(tree)) return tree.map(node => find(node, id)).find(Boolean);
  if (!tree || typeof tree !== 'object') return undefined;
  if (tree.props?.testID === id) return tree;
  return find(tree.props?.children, id);
}
function loginHarness(login) {
  const react = reactHarness();
  const entered = [], routes = [], verifications = [];
  const component = load('../components/onboarding/LoginScreen.tsx', {
    react: react.react,
    'react-native': { BackHandler: {}, Keyboard: { dismiss() {} }, Text: 'Text',
      Animated: { Value: class {}, View: 'Animated.View' } },
    'expo-router': { router: { replace: route => routes.push(route), canGoBack: () => false }, useFocusEffect() {} },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/kyc/parts': { Heading: 'Heading', Notice: 'Notice', PrimaryButton: 'Button', Progress: 'Progress', s: {} },
    './SignupFields': { AuthField: 'AuthField', PasswordField: 'PasswordField', noStoreProps: {} },
    './Shell': { Shell: 'Shell', StepTransition: 'StepTransition' },
    './model': { validateLogin: (identifier, password) => password.length >= 8 ? {} : { password: 'Too short' } },
    './session': { useDemoSession: () => ({ pending: false, error: null }), completeLogin: async token => entered.push(token) },
    '@/services/api': {
      authApi: { login, verify2FA: async (...args) => { verifications.push(args); return { token: 'verified-session' }; } },
      ApiError: class extends Error {},
    },
    '@/services/passkeys': {},
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast() {} }) },
    './SessionLimitSheet': { SessionLimitSheet: 'SessionLimitSheet' },
    './RecoveryScreen': { RecoveryScreen: 'Recovery' },
    './sessionLimit': load('../components/onboarding/sessionLimit.ts', {}),
  });
  let tree;
  const render = () => { tree = react.render(() => component.LoginScreen()).props.children[0]; return tree; };
  const button = id => find(tree.props.footer, id).props;
  render();
  find(tree, 'login-identifier').props.onChangeText('alice@example.test'); render();
  button('login-next').onPress(); render();
  find(tree, 'login-password').props.onChangeText('fixture-password'); render();
  return { render, button, entered, routes, verifications, field: () => find(tree, 'login-password').props };
}

test('login waits for a real token before entering protected routes', async () => {
  let resolve;
  const app = loginHarness(() => new Promise(done => { resolve = done; }));
  const result = app.button('login-submit').onPress();
  assert.equal(app.entered.length, 0); assert.equal(app.routes.length, 0);
  resolve({ token: 'backend-issued-session' });
  await result;
  assert.deepEqual(app.entered, ['backend-issued-session']);
  assert.deepEqual(app.routes, ['/']);
});

test('invalid credentials never enter the wallet', async () => {
  const app = loginHarness(async () => { throw new Error('Invalid credentials'); });
  await app.button('login-submit').onPress(); app.render();
  assert.equal(app.entered.length, 0); assert.equal(app.routes.length, 0);
  assert.equal(app.button('login-submit').label, 'Login');
});

test('a two-factor challenge cannot be bypassed by a successful password response', async () => {
  const app = loginHarness(async () => ({ require2FA: true, userId: 'user-id', message: 'Verification required' }));
  await app.button('login-submit').onPress(); app.render();
  assert.equal(app.entered.length, 0);
  assert.equal(app.field().label, 'Verification code');
  app.field().onChangeText('654321'); app.render();
  await app.button('login-submit').onPress();
  assert.deepEqual(app.verifications, [['user-id', '654321']]);
  assert.deepEqual(app.entered, ['verified-session']);
});

function walletHarness(send) {
  const react = reactHarness();
  const calls = [], refreshes = [];
  class BackendError extends Error {
    constructor(message, status = 400) { super(message); this.status = status; }
  }
  const { Wallet } = load('../components/wallet/Wallet.tsx', {
    '@/components/BackendScreenState': { BackendScreenState: 'BackendScreenState' },
    react: react.react, './MoneyCard': { MoneyCard: 'MoneyCard' },
    './recipient': { recipientError: () => null },
    'expo-router': { router: { push() {} } },
    '@/services/api': { ApiError: BackendError, walletApi: {
      stats() {}, lookup: async value => { calls.push(['lookup', value]); return { address: 'destination' }; },
      send: async (...args) => {
        calls.push(['send', ...args]);
        const result = await send(BackendError);
        refreshes.push(true); // Successful API writes now own cache invalidation.
        return result;
      },
    } },
    '@/services/transactions': { getAllTransactions() {}, walletTransaction() {} },
    '@/hooks/useBackendResource': { useBackendResource: () => ({
      data: { stats: { ath_balance: '100', wallet_address: 'real-address', is_transfer_enabled: true }, transactions: [] },
      error: null,
    }) },
    '@/services/refresh': { refreshBackendData: () => refreshes.push(true) },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast() {} }) },
  });
  return { tree: react.render(() => Wallet()), calls, refreshes };
}
const transfer = { recipient: { method: 'username', value: '@alice' }, amount: 2.5, note: '' };

test('wallet sends through lookup and backend transfer before returning a real receipt', async () => {
  const app = walletHarness(async () => ({ hash: 'server-transfer-reference' }));
  const receipt = await app.tree.props.onSend(transfer);
  assert.deepEqual(app.calls, [['lookup', 'alice'], ['send', 'alice', 2.5]]);
  assert.equal(receipt.reference, 'server-transfer-reference');
  assert.equal(receipt.demo, false);
  assert.equal(app.refreshes.length, 1);
  assert.equal(app.tree.props.balance, 100, 'The view never invents an optimistic debit');
});

test('a backend transfer error cannot produce a local receipt or a fake debit', async () => {
  const app = walletHarness(async BackendError => { throw new BackendError('Transfer rejected'); });
  await assert.rejects(app.tree.props.onSend(transfer), /Transfer rejected/);
  assert.equal(app.refreshes.length, 0);
  assert.equal(app.tree.props.balance, 100);
});

test('address sends bypass the email-only lookup but still require backend confirmation', async () => {
  const app = walletHarness(async () => ({ hash: 'address-transfer-reference' }));
  await app.tree.props.onSend({ ...transfer, recipient: { method: 'address', value: '0xInternalAddress' } });
  assert.deepEqual(app.calls, [['send', '0xInternalAddress', 2.5]]);
});

test('a missing transfer reference is rejected instead of replaced by a random demo hash', async () => {
  const app = walletHarness(async () => ({}));
  await assert.rejects(app.tree.props.onSend(transfer), /unconfirmed/);
  assert.equal(app.tree.props.balance, 100);
});

test('a network failure offers same-details recovery through the idempotent API', async () => {
  const app = walletHarness(async () => { throw new Error('Network disconnected'); });
  await assert.rejects(app.tree.props.onSend(transfer), /same recipient and amount/);
  await assert.rejects(app.tree.props.onSend(transfer), /same recipient and amount/);
  assert.equal(app.calls.filter(call => call[0] === 'send').length, 2);
  assert.equal(app.tree.props.balance, 100);
});

test('saved practice preferences do not grant an authenticated session', async () => {
  let token = null;
  const storage = { getItem: async () => 'entered', setItem: async () => {} };
  const sessions = load('../components/onboarding/session.ts', {
    react: {},
    '@react-native-async-storage/async-storage': storage,
    '@/services/api': {
      getToken: async () => token, setToken: async value => { token = value; },
      clearToken: async () => { token = null; }, onSessionExpired() {},
      userApi: { me: async () => ({ id: 'real-user' }) }, authApi: {}, ApiError: class extends Error {},
    },
  });
  const store = sessions.createDemoSessionStore(storage);
  await store.load();
  assert.equal(store.getSnapshot().entered, false);
  await assert.rejects(store.enter(), /sign in/i);
});
