import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Keyboard } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Heading, Notice, PrimaryButton, Progress } from '@/components/kyc/parts';
import { AuthField, PasswordField, noStoreProps } from './SignupFields';
import { Shell, StepTransition } from './Shell';
import { validateLogin } from './model';
import { completeLogin, useDemoSession } from './session';
import { authApi, ApiError } from '@/services/api';
import { getCredential } from '@/services/passkeys';
import { useToast } from '@/components/toast/ToastProvider';
import { SessionLimitSheet } from './SessionLimitSheet';
import { readSessionLimit, type SessionLimit } from './sessionLimit';

type Step = 'identifier' | 'password' | 'passkey';

export function LoginScreen() {
  const { showToast } = useToast();
  const session = useDemoSession();
  const [step, setStep] = useState<Step>('identifier');
  const [dir, setDir] = useState<1 | -1>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<{ kind: 'twofa' | 'email' | 'verify-email'; userId: string; email?: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState<SessionLimit | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const pending = useRef<(() => Promise<any>) | null>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const busy = useRef(false);
  const active = useRef(true);
  const mounted = useRef(true);

  const clear = useCallback(() => { setIdentifier(''); setPassword(''); setChallenge(null); setErrors({}); setLimit(null); pending.current = null; }, []);
  useEffect(() => { mounted.current = true; active.current = true; return () => { mounted.current = false; active.current = false; pending.current = null; }; }, []);
  useEffect(() => {
    if (session.error) showToast({ kind: 'error', title: 'Session unavailable', body: session.error });
  }, [session.error, showToast]);
  useFocusEffect(useCallback(() => { active.current = true; return () => { active.current = false; }; }, []));

  const back = useCallback(() => {
    if (busy.current) return;
    Keyboard.dismiss();
    if (step !== 'identifier') {
      setPassword(''); setChallenge(null); setErrors({}); setLimit(null); pending.current = null;
      setDir(-1); setStep('identifier');
      return;
    }
    clear();
    if (router.canGoBack()) router.back(); else router.replace('/onboarding');
  }, [clear, step]);
  const backRef = useRef(back);
  backRef.current = back;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { backRef.current(); return true; });
    return () => sub.remove();
  }, []);

  const checkIdentifier = () => {
    const e = validateLogin(identifier, '');
    const only: Record<string, string> = e.identifier ? { identifier: e.identifier } : {};
    setErrors(only);
    if (e.identifier) showToast({ kind: 'error', title: 'Check your details', body: e.identifier });
    return !e.identifier;
  };

  const goTo = (next: Step) => {
    if (busy.current || !checkIdentifier()) return;
    Keyboard.dismiss();
    setDir(1); setStep(next);
  };

  const shakeCode = () => Animated.sequence([10, -10, 7, -7, 0].map(toValue =>
    Animated.timing(shake, { toValue, duration: 65, useNativeDriver: true }))).start();
  const reportFailure = (error: unknown) => {
    showToast({ kind: 'error', title: 'Login failed', body: error instanceof Error ? error.message : 'Please try again.' });
    if (challenge) {
      setPassword(''); setErrors({ password: 'Code rejected' });
      shakeCode();
    }
  };

  const perform = async (attempt: () => Promise<any>) => {
    try {
      const result = await attempt();
      if (!active.current) return;
      if (result.require2FA || result.requireEmailVerification) {
        pending.current = null;
        setChallenge({ kind: result.require2FA ? 'twofa' : 'email', userId: result.userId });
        setStep('password');
        setPassword('');
        showToast({ kind: 'info', title: 'Verification required', body: result.message || 'Enter your verification code.' });
        return;
      }
      if (typeof result.token !== 'string' || !result.token) throw new Error('The backend did not return an authenticated session.');
      await completeLogin(result.token);
      if (!active.current) return;
      clear();
      router.replace('/');
    } catch (error) {
      if (!active.current) return;
      if (error instanceof ApiError && error.data.code === 'USER_BLOCKED') {
        clear();
        router.replace('/account-banned');
      } else if (error instanceof ApiError && error.data.code === 'EMAIL_NOT_VERIFIED') {
        pending.current = null;
        setChallenge({ kind: 'verify-email', userId: String(error.data.userId), email: String(error.data.email) });
        setPassword('');
        try {
          await authApi.resendOtp(String(error.data.email));
          if (active.current) showToast({ kind: 'info', title: 'Verification required', body: 'Enter the code sent to your email.' });
        } catch (cause) {
          if (active.current) reportFailure(cause);
        }
      } else {
        try {
          const recovery = readSessionLimit(error as ApiError);
          if (recovery) { pending.current = attempt; setLimit(recovery); return; }
        } catch (cause) { pending.current = null; reportFailure(cause); return; }
        pending.current = null;
        reportFailure(error);
      }
    }
  };

  const open = async () => {
    if (busy.current || limit) return;
    Keyboard.dismiss();
    busy.current = true; setSaving(true);
    const attempt = async () => {
      if (step === 'passkey') {
        const identity = identifier.includes('@') ? { email: identifier.trim() } : { username: identifier.trim() };
        const options = await authApi.passkeyLoginOptions(identity);
        const credential = await getCredential(options);
        return authApi.passkeyLoginVerify({ ...credential, ...identity });
      }
      if (challenge) {
        return challenge.kind === 'verify-email' ? authApi.verifyEmail(challenge.email!, password)
          : challenge.kind === 'twofa' ? authApi.verify2FA(challenge.userId, password)
          : authApi.verifySuspiciousLogin(challenge.userId, password);
      }
      return authApi.login(identifier.trim(), password);
    };
    try { await perform(attempt); } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const closeLimit = () => {
    if (busy.current) return;
    setLimit(null); pending.current = null; setPassword('');
  };
  const removeSession = async (id: string) => {
    const attempt = pending.current;
    if (busy.current || !attempt || !limit?.sessions.some(item => item.id === id)) return;
    busy.current = true; setSaving(true); setRemoving(id);
    try {
      await authApi.removeSessionManaged(id, limit.token);
      if (!active.current) return;
      setLimit(null);
      await perform(attempt);
    } catch (error) {
      if (active.current) {
        if (error instanceof ApiError && error.status === 401) {
          setLimit(null); pending.current = null; setPassword('');
        }
        reportFailure(error);
      }
    } finally {
      busy.current = false;
      if (mounted.current) { setSaving(false); setRemoving(null); }
    }
  };
  const submit = () => {
    if (busy.current) return;
    const e = challenge
      ? (/^\d{6}$/.test(password) ? {} : { password: 'Enter the six-digit verification code.' })
      : validateLogin(identifier, password);
    setErrors(e);
    if (Object.keys(e).length) {
      showToast({ kind: 'error', title: 'Check your details', body: Object.values(e)[0] });
      if (challenge) shakeCode();
      if (e.identifier) { setDir(-1); setStep('identifier'); } return;
    }
    return open();
  };

  const edit = (set: (v: string) => void, key: string) => (v: string) => {
    set(v); if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  };
  const disabled = saving || session.pending;

  const footer = step === 'identifier' ? <>
    <PrimaryButton testID="login-next" label="Next" onPress={() => goTo('password')} />
    <PrimaryButton testID="login-passkey" variant="ghost" label="Login with passkey" onPress={() => goTo('passkey')} />
  </> : step === 'password' ? <>
    <PrimaryButton testID="login-submit" label={challenge ? 'Verify code' : 'Login'} loading={saving} disabled={disabled} onPress={submit} />
  </> : <>
    <PrimaryButton testID="login-passkey-confirm" label="Confirm passkey" loading={saving} disabled={disabled} onPress={open} />
    <PrimaryButton testID="login-passkey-cancel" variant="ghost" label="Cancel" disabled={saving} onPress={back} />
  </>;

  return (
    <><Shell testID="login-screen" backID="login-back" backLabel={step === 'identifier' ? 'Back to welcome' : 'Previous step'} onBack={back} footer={footer}>
      <Progress step={step === 'identifier' ? 1 : 2} total={2} />
      <StepTransition testID={`login-step-${step}`} stepKey={step} dir={dir}>
        {step === 'identifier' && <React.Fragment key="identifier">
          <Heading eyebrow="Step 1 of 2" title="Welcome back" body="Enter the email or username registered with your account." />
          <AuthField testID="login-identifier" label="Email or username" value={identifier} onChangeText={edit(setIdentifier, 'identifier')}
            error={errors.identifier} placeholder="you@example.com" {...noStoreProps} keyboardType="email-address"
            returnKeyType="next" onSubmitEditing={() => goTo('password')} />
          <Notice icon="lock" text="Sign in to your real AtherChain account. Credentials are verified by the backend." />
        </React.Fragment>}
        {step === 'password' && <React.Fragment key="password">
          <Heading eyebrow="Step 2 of 2" title={challenge ? 'Enter your verification code' : 'Enter your password'} body={challenge ? (challenge.kind === 'twofa' ? 'Use the current code from your authenticator.' : 'Use the code sent to your account email.') : `Logging in as ${identifier.trim()}. Use 8 to 128 characters.`} />
          <Animated.View style={{ transform: [{ translateX: shake }] }}>
            <PasswordField testID="login-password" label={challenge ? 'Verification code' : 'Password'} value={password} onChangeText={edit(setPassword, 'password')}
              error={errors.password} keyboardType={challenge ? 'number-pad' : 'default'} maxLength={challenge ? 6 : 128}
              returnKeyType="done" onSubmitEditing={submit} />
          </Animated.View>
          <Notice icon="lock" text="Your credentials are sent securely for verification. Your password is not saved on this device." />
        </React.Fragment>}
        {step === 'passkey' && <React.Fragment key="passkey">
          <Heading eyebrow="Passkey" title="Confirm passkey login" body={`Continue as ${identifier.trim()} with your registered passkey.`} />
          <Notice icon="key" text="Your device or browser will ask you to verify with a registered passkey. AtherChain verifies the signed response." />
        </React.Fragment>}
      </StepTransition>
    </Shell><SessionLimitSheet limit={limit} removing={removing} onRemove={removeSession} onClose={closeLimit} /></>
  );
}
