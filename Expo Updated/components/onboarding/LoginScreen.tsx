import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Heading, Notice, PrimaryButton, Progress, s } from '@/components/kyc/parts';
import { AuthField, PasswordField, noStoreProps } from './SignupFields';
import { Shell, StepTransition } from './Shell';
import { validateLogin } from './model';
import { completeLogin, useDemoSession } from './session';
import { authApi, ApiError } from '@/services/api';
import { getCredential } from '@/services/passkeys';

type Step = 'identifier' | 'password' | 'passkey';

export function LoginScreen() {
  const c = useColors();
  const session = useDemoSession();
  const [step, setStep] = useState<Step>('identifier');
  const [dir, setDir] = useState<1 | -1>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<{ kind: 'twofa' | 'email' | 'verify-email'; userId: string; email?: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const busy = useRef(false);
  const active = useRef(true);

  const clear = useCallback(() => { setIdentifier(''); setPassword(''); setChallenge(null); setErrors({}); setSaveError(null); }, []);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useFocusEffect(useCallback(() => { active.current = true; return () => { active.current = false; }; }, []));

  const back = useCallback(() => {
    if (busy.current) return;
    Keyboard.dismiss();
    if (step !== 'identifier') {
      setPassword(''); setChallenge(null); setErrors({}); setSaveError(null);
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
    return !e.identifier;
  };

  const goTo = (next: Step) => {
    if (busy.current || !checkIdentifier()) return;
    Keyboard.dismiss(); setSaveError(null);
    setDir(1); setStep(next);
  };

  const open = async () => {
    if (busy.current) return;
    Keyboard.dismiss();
    busy.current = true; setSaving(true); setSaveError(null);
    try {
      let result;
      if (step === 'passkey') {
        const identity = identifier.includes('@') ? { email: identifier.trim() } : { username: identifier.trim() };
        const options = await authApi.passkeyLoginOptions(identity);
        const credential = await getCredential(options);
        result = await authApi.passkeyLoginVerify({ ...credential, ...identity });
      } else if (challenge) {
        result = challenge.kind === 'verify-email'
          ? await authApi.verifyEmail(challenge.email!, password)
          : challenge.kind === 'twofa'
          ? await authApi.verify2FA(challenge.userId, password)
          : await authApi.verifySuspiciousLogin(challenge.userId, password);
      } else {
        result = await authApi.login(identifier.trim(), password);
      }
      if (result.require2FA || result.requireEmailVerification) {
        setChallenge({ kind: result.require2FA ? 'twofa' : 'email', userId: result.userId });
        setPassword('');
        setSaveError(result.message);
        return;
      }
      await completeLogin(result.token);
      if (!active.current) return;
      clear();
      router.replace('/');
    } catch (error) {
      if (error instanceof ApiError && error.data.code === 'USER_BLOCKED') {
        clear();
        router.replace('/account-banned');
      } else if (error instanceof ApiError && error.data.code === 'EMAIL_NOT_VERIFIED') {
        setChallenge({ kind: 'verify-email', userId: String(error.data.userId), email: String(error.data.email) });
        setPassword('');
        try {
          await authApi.resendOtp(String(error.data.email));
          setSaveError('Enter the verification code sent to your email.');
        } catch (cause) {
          setSaveError(cause instanceof Error ? cause.message : 'Could not send the email code. Go back and retry sign-in.');
        }
      } else if (active.current) setSaveError(error instanceof Error ? error.message : 'Login failed. Please retry.');
    } finally {
      busy.current = false;
      if (active.current) setSaving(false);
    }
  };

  const submit = () => {
    if (busy.current) return;
    const e = challenge
      ? (/^\d{6}$/.test(password) ? {} : { password: 'Enter the six-digit verification code.' })
      : validateLogin(identifier, password);
    setErrors(e);
    if (Object.keys(e).length) { if (e.identifier) { setDir(-1); setStep('identifier'); } return; }
    return open();
  };

  const err = saveError ?? (session.error && !saving ? session.error : null);
  const edit = (set: (v: string) => void, key: string) => (v: string) => {
    set(v); if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  };
  const errText = !!err && step !== 'identifier' &&
    <Text accessibilityRole="alert" style={[s.error, { color: c.walletError, textAlign: 'center' }]}>{err}</Text>;
  const disabled = saving || session.pending;

  const footer = step === 'identifier' ? <>
    <PrimaryButton testID="login-next" label="Next" onPress={() => goTo('password')} />
    <PrimaryButton testID="login-passkey" variant="ghost" label="Login with passkey" onPress={() => goTo('passkey')} />
  </> : step === 'password' ? <>
    {errText}
    <PrimaryButton testID="login-submit" label={saving ? 'Opening…' : err ? 'Retry' : 'Login'} disabled={disabled} onPress={submit} />
  </> : <>
    {errText}
    <PrimaryButton testID="login-passkey-confirm" label={saving ? 'Opening…' : err ? 'Retry' : 'Confirm passkey'} disabled={disabled} onPress={open} />
    <PrimaryButton testID="login-passkey-cancel" variant="ghost" label="Cancel" disabled={saving} onPress={back} />
  </>;

  return (
    <Shell testID="login-screen" backID="login-back" backLabel={step === 'identifier' ? 'Back to welcome' : 'Previous step'} onBack={back} footer={footer}>
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
          <PasswordField testID="login-password" label={challenge ? 'Verification code' : 'Password'} value={password} onChangeText={edit(setPassword, 'password')}
            error={errors.password} returnKeyType="done" onSubmitEditing={submit} />
          <Notice icon="lock" text="Your credentials are sent securely for verification. Your password is not saved on this device." />
        </React.Fragment>}
        {step === 'passkey' && <React.Fragment key="passkey">
          <Heading eyebrow="Passkey" title="Confirm passkey login" body={`Continue as ${identifier.trim()} with your registered passkey.`} />
          <Notice icon="key" text="Your device or browser will ask you to verify with a registered passkey. AtherChain verifies the signed response." />
        </React.Fragment>}
      </StepTransition>
    </Shell>
  );
}
