import test from 'node:test';
import assert from 'node:assert/strict';
import { load, hooks, byId, byType, nodes, deferred } from './auth-test-utils.mjs';

function scanner({ response, confirm = true } = {}) {
  const h = hooks(), calls = [], errors = [], navigation = [];
  let focus, state;
  const animation = () => ({ start() {}, stop() {} });
  const { ScanLoginScreen } = load('../components/scan/ScanLoginScreen.tsx', {
    react: h.react,
    'react-native': {
      ...h.native,
      AccessibilityInfo: { isReduceMotionEnabled: async () => false,
        addEventListener: () => ({ remove() {} }), announceForAccessibility() {} },
      AppState: { currentState: 'active', addEventListener: (_, fn) => {
        state = fn; return { remove() {} };
      } },
      Animated: { Value: class { setValue() {} interpolate() { return 0; } },
        View: 'AnimatedView', loop: animation, sequence: animation, timing: animation },
      Easing: { inOut: value => value, quad: 1 },
    },
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-camera': { CameraView: 'CameraView',
      useCameraPermissions: () => [{ granted: true }, async () => ({ granted: true })] },
    'expo-router': {
      useRouter: () => ({ canGoBack: () => true, back: () => navigation.push('back') }),
      useFocusEffect: fn => { focus ??= fn(); },
    },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/services/api': { authApi: { approveQRLogin: async token => {
      calls.push(token); return response ? await response.promise : { success: true };
    } } },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => errors.push(toast) }) },
    '@/components/twofa/CodeCircles': { CodeCircles: 'OtpSuccessAnimation' },
  }, { confirm: () => confirm });
  const render = () => h.render(ScanLoginScreen);
  render();
  return { render, calls, errors, navigation,
    scan: data => byId(render(), 'scan-camera').props.onBarcodeScanned({ data }),
    background: () => state('background'), unmount: h.unmount };
}
const token = 'a'.repeat(64);
const settle = async () => { await new Promise(resolve => setImmediate(resolve)); };

test('real backend approval replaces the scanner with the exact OTP success animation', async () => {
  const response = deferred(), app = scanner({ response });
  assert.ok(byId(app.render(), 'scan-frame'));
  app.scan(JSON.stringify({ qrToken: token }));
  await settle();
  let tree = app.render();
  assert.ok(byId(tree, 'scan-approving'));
  assert.equal(byId(tree, 'scan-line'), undefined);
  assert.equal(byId(tree, 'scan-success'), undefined);
  app.scan(token);
  assert.equal(app.calls.length, 1, 'Repeated QR detection must not duplicate approval');
  response.resolve({ success: true });
  await settle();
  tree = app.render();
  assert.equal(byId(tree, 'scan-camera'), undefined);
  assert.equal(byId(tree, 'scan-frame'), undefined);
  assert.equal(byId(tree, 'scan-approving'), undefined);
  const animation = byType(tree, 'OtpSuccessAnimation');
  assert.equal(animation.props.phase, 'success');
  assert.equal(animation.props.filled, 6);
  assert.ok(nodes(tree).some(node => node.type === 'Text' && node.props.children.includes('Scan Completed')));
  assert.equal(nodes(tree).some(node => node.type === 'Feather' && node.props.name === 'check'), false);
  animation.props.onFinished();
  assert.deepEqual(app.navigation, [], 'Success remains visible until Done is pressed');
  byId(tree, 'scan-done').props.onPress();
  assert.deepEqual(app.navigation, ['back']);
});

for (const result of ['reject', 'unsuccessful']) {
  test(`${result} approval returns to scanner without success animation`, async () => {
    const response = deferred(), app = scanner({ response });
    app.scan(token); await settle();
    if (result === 'reject') response.reject(Error('Server unavailable'));
    else response.resolve({ success: false });
    await settle();
    const tree = app.render();
    assert.equal(byId(tree, 'scan-success'), undefined);
    assert.equal(byId(tree, 'scan-approving'), undefined);
    assert.ok(byId(tree, 'scan-frame'));
    assert.equal(app.errors.length, 1);
  });
}
test('cancelled approval and invalid codes never display success or call backend', async () => {
  const app = scanner({ confirm: false });
  app.scan('not-a-login-token');
  app.scan(token);
  await settle();
  assert.equal(app.calls.length, 0);
  assert.equal(byId(app.render(), 'scan-success'), undefined);
});
