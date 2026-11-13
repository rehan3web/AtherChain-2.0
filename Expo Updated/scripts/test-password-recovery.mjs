import test from 'node:test';
import assert from 'node:assert/strict';
import { load, hooks, byId, byType, deferred } from './auth-test-utils.mjs';

const settle = async () => new Promise(resolve => setImmediate(resolve));
function recovery(kind = 'password', api = {}) {
  const h = hooks(), toasts = [], calls = [], backs = [], done = [];
  const confirmed = { message: 'Confirmed', userId: 'fixture-owner' };
  const methods = ['forgotPassword', 'start2FARecovery', 'verifyResetOTP', 'verify2FARecovery', 'resetPassword'];
  const authApi = Object.fromEntries(methods.map(method => [method, async (...args) => {
    calls.push([method, ...args]);
    return api[method] ? await api[method](...args) : confirmed;
  }]));
  const { RecoveryScreen } = load('../components/onboarding/RecoveryScreen.tsx', {
    react: h.react, 'react-native': h.native, 'expo-router': { useFocusEffect() {} },
    '@/services/api': { authApi },
    '@/components/kyc/parts': { Heading: 'Heading', PrimaryButton: 'Button' },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: toast => toasts.push(toast) }) },
    './SignupFields': { AuthField: 'Field', PasswordField: 'Field', noStoreProps: {} },
    './Shell': { Shell: 'Shell' }, './RecoveryOtp': { RecoveryOtp: 'Otp' },
    './model': { maskSignupEmail: email => email },
  }, { Error });
  const render = () => h.render(() => RecoveryScreen({ kind, initialEmail: '', onBack: () => backs.push(true), onDone: () => done.push(true) }));
  return { ...h, render, calls, toasts, done, backs,
    change: (id, value) => byId(render(), id).props.onChangeText(value),
    async next() { byId(render(), 'recovery-next').props.onPress(); await settle(); return render(); },
    otp: () => byType(render(), 'Otp').props,
  };
}
test('password reset follows email → verified OTP animation → new password → toast and Login', async () => {
  const app = recovery();
  app.change('recovery-email', '  OWNER@Test.Example ');
  await app.next();
  assert.deepEqual(app.calls[0], ['forgotPassword', 'owner@test.example']);
  await app.otp().verify('123456');
  assert.equal(byId(app.render(), 'recovery-password'), undefined, 'Wait for tick animation to finish');
  app.otp().onVerified('123456');
  app.change('recovery-password', 'new-test-password');
  app.change('recovery-confirm-password', 'new-test-password');
  await app.next();
  assert.deepEqual(app.calls[1], ['verifyResetOTP', 'owner@test.example', '123456']);
  assert.deepEqual(app.calls[2], ['resetPassword', 'owner@test.example', '123456', 'new-test-password']);
  assert.equal(app.toasts.at(-1).title, 'Password reset');
  assert.equal(app.done.length, 1);
});
test('2FA recovery sends email, disables through its dedicated OTP endpoint and returns to Login after animation', async () => {
  const app = recovery('twofa');
  app.change('recovery-email', 'owner@test.example');
  await app.next();
  await app.otp().verify('654321');
  assert.equal(app.done.length, 0);
  app.otp().onVerified('654321');
  assert.deepEqual(app.calls, [
    ['start2FARecovery', 'owner@test.example'], ['verify2FARecovery', 'fixture-owner', '654321'],
  ]);
  assert.equal(app.toasts.at(-1).title, '2FA reset');
  assert.equal(app.done.length, 1);
  assert.equal(byId(app.render(), 'recovery-password'), undefined);
});
test('invalid email, weak passwords and mismatched confirmation never reach the reset endpoint', async () => {
  const app = recovery();
  app.change('recovery-email', 'bad'); await app.next();
  assert.equal(app.calls.length, 0);
  app.change('recovery-email', 'owner@test.example'); await app.next();
  app.otp().onVerified('123456');
  app.change('recovery-password', 'short'); app.change('recovery-confirm-password', 'short'); await app.next();
  app.change('recovery-password', 'valid-long-password'); await app.next();
  assert.equal(app.calls.some(call => call[0] === 'resetPassword'), false);
  assert.equal(app.done.length, 0);
});
test('send and reset failures show errors without claiming success; retry remains available', async () => {
  let fail = true;
  const app = recovery('password', {
    forgotPassword: async () => { if (fail) throw Error('Email unavailable'); return { message: 'Sent' }; },
    resetPassword: async () => { throw Error('Token expired'); },
  });
  app.change('recovery-email', 'owner@test.example'); await app.next();
  assert.equal(app.toasts.at(-1).body, 'Email unavailable');
  assert.equal(byType(app.render(), 'Otp'), undefined);
  fail = false; await app.next();
  app.otp().onVerified('123456');
  app.change('recovery-password', 'new-test-password'); app.change('recovery-confirm-password', 'new-test-password');
  await app.next();
  assert.equal(app.toasts.at(-1).body, 'Token expired');
  assert.equal(app.done.length, 0);
  assert.equal(byId(app.render(), 'recovery-next').props.loading, false);
});
test('duplicate sends are blocked and Back/unmount cannot start a late recovery step', async () => {
  const waiting = deferred(), app = recovery('password', { forgotPassword: () => waiting.promise });
  app.change('recovery-email', 'owner@test.example');
  byId(app.render(), 'recovery-next').props.onPress();
  byId(app.render(), 'recovery-next').props.onPress();
  byType(app.render(), 'Shell').props.onBack();
  assert.equal(app.calls.length, 1); assert.equal(app.backs.length, 0);
  assert.equal(byId(app.render(), 'recovery-next').props.loading, true);
  app.unmount(); waiting.resolve({ message: 'Sent' }); await settle();
  assert.equal(app.done.length, 0);
});
test('2FA email resend retains the new recovery account and rejects an incomplete backend response', async () => {
  let calls = 0;
  const app = recovery('twofa', { start2FARecovery: async () => {
    calls++; return calls === 1 ? { message: 'Sent' } : { message: 'Sent', userId: 'new-owner' };
  } });
  app.change('recovery-email', 'owner@test.example'); await app.next();
  assert.equal(byType(app.render(), 'Otp'), undefined);
  await app.next(); await app.otp().resend();
  await app.otp().verify('123456');
  assert.deepEqual(app.calls.at(-1), ['verify2FARecovery', 'new-owner', '123456']);
});

function otp(api = {}) {
  const h = hooks(), toasts = [], verified = [], backs = [];
  let currentAppState;
  const { RecoveryOtp } = load('../components/onboarding/RecoveryOtp.tsx', {
    react: h.react, 'react-native': { ...h.native, AppState: {
      addEventListener: (_, callback) => { currentAppState = callback; return { remove() {} }; },
    } },
    'expo-router': { useFocusEffect() {} },
    '@/components/twofa/CodeCircles': { CodeCircles: 'Circles' },
    '@/components/twofa/demo': { CODE_LENGTH: 6 },
    '@/components/wallet/NumericKeypad': { NumericKeypad: 'Keypad' },
    '@/components/wallet/format': { BACKSPACE: 'backspace' },
    '@/components/kyc/parts': { Heading: 'Heading', PrimaryButton: 'Button' },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: value => toasts.push(value) }) },
    './Shell': { Shell: 'Shell' },
  }, { Error, setTimeout: h.setTimeout, clearTimeout: h.clearTimeout });
  const render = () => h.render(() => RecoveryOtp({ email: 'o•••@test.example',
    verify: api.verify ?? (async () => {}), resend: api.resend ?? (async () => {}),
    onVerified: code => verified.push(code), onBack: () => backs.push(true) }));
  return { ...h, render, verified, backs, toasts,
    key: key => byType(render(), 'Keypad').props.onKey(key),
    background: () => currentAppState('background'),
  };
}
test('OTP uses the signup keypad and waits for real verification before the exact success animation', async () => {
  const waiting = deferred(), app = otp({ verify: () => waiting.promise });
  assert.equal(byType(app.render(), 'Keypad').props.hideDecimal, true);
  for (const key of '123456') app.key(key);
  assert.equal(byId(app.render(), 'recovery-verify'), undefined);
  assert.ok(byId(app.render(), 'recovery-verifying'));
  assert.equal(byType(app.render(), 'Keypad').props.disabled, true);
  assert.equal(byType(app.render(), 'Circles').props.phase, 'entry');
  waiting.resolve(); await settle();
  assert.equal(byType(app.render(), 'Circles').props.phase, 'success');
  assert.equal(byId(app.render(), 'recovery-verifying'), undefined);
  assert.equal(app.verified.length, 0);
  byType(app.render(), 'Circles').props.onFinished();
  assert.deepEqual(app.verified, ['123456']);
});
test('OTP has no Verify code button and keeps only the resend action below the keypad', () => {
  const app = otp();
  assert.equal(byId(app.render(), 'recovery-verify'), undefined);
  assert.equal(byType(app.render(), 'Button').props.testID, 'recovery-resend');
  assert.equal(byType(app.render(), 'Shell').props.surface, 'wallet');
});

test('OTP wallet surface uses the wallet sheet color without changing the default onboarding surface', () => {
  const h = hooks();
  const palette = { walletSheet: '#fefefe', miningPage: '#f6f6f7', background: '#ffffff' };
  const { Shell } = load('../components/onboarding/Shell.tsx', {
    react: h.react, 'react-native': h.native,
    '@expo/vector-icons': { Feather: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/hooks/useColors': { useColors: () => palette },
    '@/components/wallet/primitives': { EASE_OUT: null, useReducedMotion: () => true },
  });
  const props = { testID: 'shell', backID: 'back', backLabel: 'Back', onBack() {} };
  assert.equal(byId(h.render(() => Shell({ ...props, surface: 'wallet' })), 'shell').props.style.backgroundColor, '#fefefe');
  assert.equal(byId(h.render(() => Shell(props)), 'shell').props.style.backgroundColor, '#f6f6f7');
  palette.walletSheet = '#1b1b1f';
  assert.equal(byId(h.render(() => Shell({ ...props, surface: 'wallet' })), 'shell').props.style.backgroundColor, '#1b1b1f');
});
test('invalid/expired OTP animates rejection, clears digits and permits retry', async () => {
  const app = otp({ verify: async () => { throw Error('Invalid or expired code'); } });
  for (const key of '123456') app.key(key);
  await settle();
  assert.equal(byType(app.render(), 'Circles').props.phase, 'error');
  assert.equal(app.toasts.at(-1).body, 'Invalid or expired code');
  byType(app.render(), 'Circles').props.onFinished();
  assert.equal(byType(app.render(), 'Circles').props.phase, 'entry');
  assert.equal(byType(app.render(), 'Circles').props.filled, 0);
  assert.equal(app.verified.length, 0);
});
test('resend is throttled locally and clears the old OTP after a successful resend', async () => {
  let sends = 0;
  const app = otp({ resend: async () => { sends++; } });
  app.render();
  byId(app.render(), 'recovery-resend').props.onPress(); await settle();
  assert.equal(sends, 0);
  for (let seconds = 0; seconds < 60; seconds++) { app.tick(); app.render(); }
  app.key('1');
  byId(app.render(), 'recovery-resend').props.onPress(); await settle();
  assert.equal(sends, 1);
  assert.equal(byType(app.render(), 'Circles').props.filled, 0);
  assert.equal(byId(app.render(), 'recovery-resend').props.disabled, true);
});
test('backgrounding cancels pending OTP completion and stale animation callbacks', async () => {
  const waiting = deferred(), app = otp({ verify: () => waiting.promise });
  for (const key of '123456') app.key(key);
  app.background(); waiting.resolve(); await settle();
  assert.equal(byType(app.render(), 'Circles').props.phase, 'entry');
  byType(app.render(), 'Circles').props.onFinished();
  assert.equal(app.verified.length, 0);
});
