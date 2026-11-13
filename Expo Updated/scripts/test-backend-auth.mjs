import assert from 'node:assert/strict';
import test from 'node:test';
import { load, hooks, nodes, byId, byType, deferred } from './auth-test-utils.mjs';

class ApiError extends Error {
  constructor(message, status, data = {}) { super(message); this.status = status; this.data = data; }
}
const limitError = () => new ApiError('Session limit', 403, {
  code: 'SESSION_LIMIT_EXCEEDED', sessionManagementToken: 'limited-token',
  sessions: [{ id: 'old-one', device: 'Phone', token: 'must-not-display' }, { id: 'old-two', device: 'Browser' }],
});
function app(kind, api = {}, complete = async () => {}) {
  const h = hooks(), toasts = [], routes = [], entered = [];
  const showToast = toast => toasts.push(toast);
  const model = load('../components/onboarding/model.ts', {
    'libphonenumber-js': { isPossiblePhoneNumber: () => true },
    '@/components/kyc/countries': { COUNTRIES: [{ name: 'United States' }] },
    './phoneCountries': { isPhoneCountry: () => true },
  });
  const cancelRef = { current: () => true };
  const deps = {
    react: h.react, 'react-native': h.native,
    'expo-router': { router: { replace: route => routes.push(route), canGoBack: () => false }, useFocusEffect() {} },
    '@expo/vector-icons': { Feather: 'Icon' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/hooks/useColors': { useColors: () => ({ walletError: 'red' }) },
    '@/components/kyc/parts': { Heading: 'Heading', Notice: 'Notice', PrimaryButton: 'Button', Progress: 'Progress' },
    '@/components/kyc/LanguageSheet': { CountrySheet: 'CountrySheet' },
    '@/components/kyc/countries': { COUNTRIES: [{ name: 'United States', code: 'US' }] },
    '@/components/wallet/NumericKeypad': { NumericKeypad: 'Keypad' },
    '@/components/wallet/format': { BACKSPACE: 'backspace' },
    '@/components/twofa/CodeCircles': { CodeCircles: 'Circles' },
    '@/components/twofa/demo': { CODE_LENGTH: 6 },
    './model': model,
    './Shell': { Shell: 'Shell', StepTransition: 'StepTransition' },
    './SignupFields': { AuthField: 'Field', PasswordField: 'Field', PhoneField: 'Phone', SelectField: 'Select' },
    './CallingCodeSheet': { CallingCodeSheet: 'CallingSheet' }, './SignupOtp': { SignupOtp: 'Otp' },
    './SessionLimitSheet': { SessionLimitSheet: 'LimitSheet' },
    './RecoveryScreen': { RecoveryScreen: 'Recovery' },
    './sessionLimit': load('../components/onboarding/sessionLimit.ts'),
    './session': { useDemoSession: () => ({ pending: false }), completeLogin: async token => { await complete(token); entered.push(token); } },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast }) },
    '@/services/api': { authApi: api, ApiError },
    '@/services/passkeys': { getCredential: api.getCredential ?? (async () => ({ id: 'signed-credential' })) },
    'libphonenumber-js': { parsePhoneNumberFromString: () => ({ number: '+12025550123' }) },
  };
  const component = load(`../components/onboarding/${kind}.tsx`, deps, {
    setTimeout: h.setTimeout, clearTimeout: h.clearTimeout,
  })[kind];
  const render = () => h.render(() => kind === 'SignupOtp'
    ? component({ email: 'first@test.example', maskedEmail: 'f•••@test.example', cancelRef,
      onBack() {}, onDone: () => routes.push('cleared') }) : component());
  let tree = render();
  return { ...h, model, toasts, routes, entered, cancelRef,
    render() { tree = render(); return tree; },
    id: id => byId(tree, id)?.props,
    type: type => byType(tree, type)?.props,
    text: () => JSON.stringify(tree),
    change(id, value) { byId(tree, id).props.onChangeText(value); tree = render(); },
    async press(id) { const result = byId(tree, id).props.onPress(); tree = render(); await result; tree = render(); },
  };
}
async function password(app) {
  app.change('login-identifier', 'first@test.example'); await app.press('login-next');
  app.change('login-password', 'fixture-password');
}
test('Login exposes password and 2FA recovery and clears credentials when returning', async () => {
  for (const kind of ['password', 'twofa']) {
    const a = app('LoginScreen', { login: async () => ({ require2FA: true, userId: 'fixture-owner' }) });
    assert.equal(a.id('login-forgot-password'), undefined);
    assert.equal(a.id('login-reset-twofa'), undefined);
    await password(a);
    assert.ok(a.id('login-forgot-password'));
    assert.equal(a.id('login-forgot-password').style({ pressed: false })[0].alignSelf, 'flex-end');
    assert.equal(a.id('login-reset-twofa'), undefined);
    if (kind === 'twofa') {
      await a.press('login-submit');
      assert.equal(a.id('login-forgot-password'), undefined);
      assert.ok(a.id('login-reset-twofa'));
    }
    const link = a.id(kind === 'password' ? 'login-forgot-password' : 'login-reset-twofa');
    assert.equal(link.style({ pressed: false })[0].marginTop, -14);
    assert.equal(link.style({ pressed: false })[0].minHeight, 44);
    await a.press(kind === 'password' ? 'login-forgot-password' : 'login-reset-twofa');
    assert.equal(a.type('Recovery').kind, kind);
    assert.equal(a.type('Recovery').initialEmail, 'first@test.example');
    a.type('Recovery').onDone(); a.render();
    assert.equal(a.id('login-identifier').value, '');
    assert.equal(a.type('Recovery'), undefined);
    assert.equal(a.entered.length, 0);
  }
});
function digits(app, code) {
  for (const digit of code) { app.type('Keypad').onKey(digit); app.render(); }
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

test('signup requires Email first and Username next without a second email input', async () => {
  const a = app('SignupScreen');
  assert.equal(a.id('signup-identifier').label, 'Email');
  a.change('signup-identifier', 'username_only'); await a.press('signup-next');
  assert.equal(a.toasts.at(-1).kind, 'error');
  assert.equal(a.id('signup-email'), undefined);
  assert.ok(a.id('signup-identifier').error);
  a.change('signup-identifier', 'first@test.example'); await a.press('signup-next');
  assert.ok(a.id('signup-username'));
  assert.equal(a.model.getSignupEmail({ identifier: ' first@test.example ', email: 'wrong@test.example' }), 'first@test.example');
  assert.equal(Object.keys(a.model.validateLogin('valid_username', 'fixture-password')).length, 0);
});
test('phone Next shows a spinner throughout registration and duplicate taps do not register twice', async () => {
  const pending = deferred(), payloads = [];
  const a = app('SignupScreen', { register: payload => { payloads.push(payload); return payloads.length === 1 ? pending.promise : Promise.resolve({}); } });
  for (const [id, value] of [['signup-identifier', 'first@test.example'], ['signup-username', 'first_user']]) {
    a.change(id, value); await a.press('signup-next');
  }
  a.change('signup-password', 'fixture-password'); a.change('signup-confirm', 'fixture-password'); await a.press('signup-next');
  a.change('signup-first-name', 'First'); a.change('signup-last-name', 'Person'); await a.press('signup-next');
  a.id('signup-country').onPress(); a.render();
  a.type('CountrySheet').onSelect('United States'); a.render(); await a.press('signup-next');
  await a.press('signup-skip');
  a.type('Phone').onChange('2025550123'); a.render();
  const request = a.press('signup-next');
  assert.equal(a.id('signup-next').loading, true);
  await a.press('signup-next'); assert.equal(payloads.length, 1);
  pending.reject(new Error('Email send unavailable')); await request;
  assert.equal(a.id('signup-next').loading, false);
  assert.ok(a.type('Phone')); assert.equal(a.toasts.at(-1).kind, 'error');
  assert.equal(payloads[0].email, 'first@test.example');
  await a.press('signup-next');
  assert.equal(a.type('Otp').email, 'first@test.example'); assert.equal(payloads.length, 2);
});
test('invalid OTP produces red shake phase and toast, then accepts a corrected code without Retry UI', async () => {
  const calls = [], pending = deferred();
  const a = app('SignupOtp', { verifyEmail: async (email, code) => {
    calls.push([email, code]); if (code === '111111') throw new Error('Invalid OTP'); return pending.promise;
  } });
  digits(a, '111111'); await flush(); a.render();
  assert.equal(a.type('Circles').phase, 'error'); assert.equal(a.toasts.length, 1);
  assert.equal(a.toasts[0].kind, 'error'); assert.equal(a.id('signup-retry'), undefined);
  assert.ok(!a.text().includes('Invalid OTP'));
  a.type('Circles').onFinished(); a.render();
  assert.equal(a.type('Circles').phase, 'entry');
  digits(a, '222222'); assert.equal(a.id('signup-verify').loading, true);
  await a.press('signup-verify'); assert.equal(calls.length, 2);
  pending.resolve({ token: 'verified-session' }); await flush(); a.render();
  assert.equal(a.type('Circles').phase, 'success'); assert.deepEqual(a.entered, ['verified-session']);
  a.type('Circles').onFinished(); a.render(); assert.deepEqual(a.routes, ['cleared', '/']);
});
test('a verified OTP is not submitted again when local session completion needs recovery', async () => {
  let verifies = 0, enters = 0;
  const a = app('SignupOtp', { verifyEmail: async () => { verifies++; return { token: 'verified' }; } },
    async () => { if (++enters === 1) throw new Error('Could not load profile'); });
  digits(a, '123456'); await flush(); a.render();
  assert.equal(a.toasts.at(-1).kind, 'error'); a.type('Circles').onFinished(); a.render();
  assert.equal(a.id('signup-verify').label, 'Continue');
  await a.press('signup-verify'); assert.equal(verifies, 1); assert.equal(enters, 2);
});
test('resend respects cooldown, shows a pending spinner and recovers from failures', async () => {
  const pending = deferred(); let calls = 0;
  const a = app('SignupOtp', { resendOtp: () => { calls++; return pending.promise; } });
  assert.equal(a.id('signup-resend').disabled, true);
  for (let i = 0; i < 60; i++) { a.tick(); a.render(); }
  const request = a.press('signup-resend'); assert.equal(a.id('signup-resend').loading, true);
  await a.press('signup-resend'); assert.equal(calls, 1);
  pending.reject(new Error('Email temporarily unavailable')); await request; await flush(); a.render();
  assert.equal(a.id('signup-resend').loading, false); assert.equal(a.toasts.at(-1).kind, 'error');
});
test('login delay has a real loading prop, stays single-flight and never switches to Retry on errors', async () => {
  const pending = deferred(); let calls = 0;
  const a = app('LoginScreen', { login: () => { calls++; return pending.promise; } }); await password(a);
  const request = a.press('login-submit');
  assert.equal(a.id('login-submit').loading, true); await a.press('login-submit'); assert.equal(calls, 1);
  pending.reject(new Error('Invalid credentials')); await request;
  assert.equal(a.id('login-submit').label, 'Login'); assert.equal(a.id('login-submit').loading, false);
  assert.equal(a.toasts.at(-1).kind, 'error'); assert.ok(!a.text().includes('Invalid credentials')); assert.deepEqual(a.routes, []);
});
test('session limit removes only the selected session and automatically resumes login', async () => {
  let logins = 0; const deletes = [], pending = deferred();
  const a = app('LoginScreen', {
    login: async () => { if (++logins === 1) throw limitError(); return { token: 'full-session' }; },
    removeSessionManaged: (...args) => { deletes.push(args); return pending.promise; },
  }); await password(a); await a.press('login-submit');
  assert.equal(a.type('LimitSheet').limit.sessions.length, 2);
  assert.equal(a.type('LimitSheet').limit.sessions[0].token, undefined);
  const removal = a.type('LimitSheet').onRemove('old-one'); a.render();
  await a.type('LimitSheet').onRemove('old-two');
  assert.deepEqual(deletes, [['old-one', 'limited-token']]); assert.equal(a.type('LimitSheet').removing, 'old-one');
  pending.resolve({}); await removal; a.render();
  assert.equal(logins, 2); assert.deepEqual(a.entered, ['full-session']); assert.deepEqual(a.routes, ['/']);
});
test('failed session deletion remains recoverable; expired management tokens close recovery without authenticating', async () => {
  for (const status of [500, 401]) {
    const a = app('LoginScreen', { login: async () => { throw limitError(); },
      removeSessionManaged: async () => { throw new ApiError('Removal failed', status); } });
    await password(a); await a.press('login-submit');
    await a.type('LimitSheet').onRemove('old-one'); a.render();
    assert.equal(!!a.type('LimitSheet').limit, status !== 401);
    assert.equal(a.type('LimitSheet').removing, null); assert.equal(a.toasts.at(-1).kind, 'error');
    assert.deepEqual(a.entered, []);
  }
});
test('cancelling session recovery clears the pending login and credentials', async () => {
  let deletes = 0;
  const a = app('LoginScreen', { login: async () => { throw limitError(); }, removeSessionManaged: async () => { deletes++; } });
  await password(a); await a.press('login-submit'); a.type('LimitSheet').onClose(); a.render();
  assert.equal(a.id('login-password').value, '');
  await a.type('LimitSheet').onRemove('old-one'); assert.equal(deletes, 0); assert.deepEqual(a.entered, []);
});
test('session removal does not bypass two-factor verification; invalid code remains editable with a red toast', async () => {
  let logins = 0, verifies = 0;
  const a = app('LoginScreen', {
    login: async () => { if (++logins === 1) throw limitError(); return { require2FA: true, userId: 'owner' }; },
    removeSessionManaged: async () => ({}),
    verify2FA: async () => { if (++verifies === 1) throw new Error('Invalid OTP'); return { token: 'twofactor-session' }; },
  });
  await password(a); await a.press('login-submit'); await a.type('LimitSheet').onRemove('old-one'); a.render();
  assert.deepEqual(a.entered, []); assert.equal(a.id('login-password').label, 'Verification code');
  a.change('login-password', '123'); await a.press('login-submit');
  assert.equal(verifies, 0); assert.ok(a.motions.length > 0); assert.equal(a.toasts.at(-1).kind, 'error');
  a.change('login-password', '111111'); await a.press('login-submit');
  assert.equal(a.toasts.at(-1).kind, 'error'); assert.equal(a.id('login-password').value, '');
  a.change('login-password', '222222'); await a.press('login-submit'); assert.deepEqual(a.entered, ['twofactor-session']);
});
test('passkey session recovery requests a fresh challenge/credential automatically', async () => {
  let options = 0, verifies = 0;
  const a = app('LoginScreen', {
    passkeyLoginOptions: async () => { options++; return {}; },
    passkeyLoginVerify: async () => { if (++verifies === 1) throw limitError(); return { token: 'passkey-session' }; },
    removeSessionManaged: async () => ({}),
  });
  a.change('login-identifier', 'first@test.example'); await a.press('login-passkey'); await a.press('login-passkey-confirm');
  await a.type('LimitSheet').onRemove('old-two'); a.render();
  assert.equal(options, 2); assert.equal(verifies, 2); assert.deepEqual(a.entered, ['passkey-session']);
});
test('a missing authenticated token cannot complete login', async () => {
  const a = app('LoginScreen', { login: async () => ({ message: 'ok' }) });
  await password(a); await a.press('login-submit'); assert.deepEqual(a.entered, []); assert.equal(a.toasts.at(-1).kind, 'error');
});
test('cancelled passkey prompts release the spinner and allow a fresh attempt', async () => {
  let prompts = 0;
  const a = app('LoginScreen', { passkeyLoginOptions: async () => ({}),
    getCredential: async () => { if (++prompts === 1) throw new Error('Passkey cancelled'); return {}; },
    passkeyLoginVerify: async () => ({ token: 'passkey-session' }) });
  a.change('login-identifier', 'valid_username'); await a.press('login-passkey');
  await a.press('login-passkey-confirm');
  assert.equal(a.id('login-passkey-confirm').loading, false);
  assert.equal(a.id('login-passkey-confirm').label, 'Confirm passkey'); assert.equal(a.toasts.at(-1).kind, 'error');
  await a.press('login-passkey-confirm'); assert.deepEqual(a.entered, ['passkey-session']);
});
test('email-verification and suspicious-login challenges complete only with their verified response', async () => {
  for (const unverified of [false, true]) {
    const resend = deferred(), verified = [];
    const a = app('LoginScreen', {
      login: async () => {
        if (unverified) throw new ApiError('Email not verified', 403, {
          code: 'EMAIL_NOT_VERIFIED', userId: 'owner', email: 'first@test.example',
        });
        return { requireEmailVerification: true, userId: 'owner' };
      },
      resendOtp: () => resend.promise,
      verifyEmail: async (...args) => { verified.push(args); return { token: 'verified-email' }; },
      verifySuspiciousLogin: async (...args) => { verified.push(args); return { token: 'verified-suspicious' }; },
    });
    await password(a); const request = a.press('login-submit');
    if (unverified) {
      await flush(); a.render(); assert.equal(a.id('login-submit').loading, true); resend.resolve({});
    }
    await request;
    assert.deepEqual(a.entered, []); assert.equal(a.id('login-password').label, 'Verification code');
    a.change('login-password', '123456'); await a.press('login-submit');
    assert.equal(verified[0][0], unverified ? 'first@test.example' : 'owner');
    assert.equal(a.entered[0], unverified ? 'verified-email' : 'verified-suspicious');
  }
});
test('the real shared button renders a spinner with a busy accessibility state', () => {
  const h = hooks();
  const { PrimaryButton } = load('../components/kyc/parts.tsx', {
    react: h.react, 'react-native': h.native, '@expo/vector-icons': { Feather: 'Icon' },
    '@/hooks/useColors': { useColors: () => ({}) },
  });
  const tree = h.render(() => PrimaryButton({ label: 'Login', loading: true, testID: 'login', onPress() {} }));
  assert.ok(byId(tree, 'login-loading')); assert.equal(tree.props.disabled, true);
  assert.equal(tree.props.accessibilityState.busy, true);
  assert.ok(!nodes(tree).some(n => n.type === 'Text'));
});
