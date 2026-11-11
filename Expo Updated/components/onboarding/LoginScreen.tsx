import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { Heading, Notice, PrimaryButton, Progress, s } from '@/components/kyc/parts';
import { AuthField, PasswordField, noStoreProps } from './SignupFields';
import { Shell, StepTransition } from './Shell';
import { isBannedDemoLogin, validateLogin } from './model';
import { enterDemo, useDemoSession } from './session';

type Step = 'identifier' | 'password' | 'passkey';

export function LoginScreen() {
  const c = useColors();
  const session = useDemoSession();
  const [step, setStep] = useState<Step>('identifier');
  const [dir, setDir] = useState<1 | -1>(1);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const busy = useRef(false);
  const active = useRef(true);

  const clear = useCallback(() => { setIdentifier(''); setPassword(''); setErrors({}); setSaveError(null); }, []);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useFocusEffect(useCallback(() => { active.current = true; return () => { active.current = false; }; }, []));

  const back = useCallback(() => {
    if (busy.current) return;
    Keyboard.dismiss();
    if (step !== 'identifier') {
      setPassword(''); setErrors({}); setSaveError(null);
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
    if (isBannedDemoLogin(identifier)) {
      clear();
      router.replace('/account-banned');
      return;
    }
    busy.current = true; setSaving(true); setSaveError(null);
    try {
      await enterDemo();
      if (!active.current) return;
      clear();
      router.replace('/');
    } catch {
      if (active.current) setSaveError('Could not open the practice wallet. Try again.');
    } finally {
      busy.current = false;
      if (active.current) setSaving(false);
    }
  };

  const submit = () => {
    if (busy.current) return;
    const e = validateLogin(identifier, password);
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
    <PrimaryButton testID="login-passkey-confirm" label={saving ? 'Opening…' : err ? 'Retry' : 'Confirm practice passkey'} disabled={disabled} onPress={open} />
    <PrimaryButton testID="login-passkey-cancel" variant="ghost" label="Cancel" disabled={saving} onPress={back} />
  </>;

  return (
    <Shell testID="login-screen" backID="login-back" backLabel={step === 'identifier' ? 'Back to welcome' : 'Previous step'} onBack={back} footer={footer}>
      <Progress step={step === 'identifier' ? 1 : 2} total={2} />
      <StepTransition testID={`login-step-${step}`} stepKey={step} dir={dir}>
        {step === 'identifier' && <React.Fragment key="identifier">
          <Heading eyebrow="Step 1 of 2" title="Welcome back" body="Enter any made-up email or username you practiced with." />
          <AuthField testID="login-identifier" label="Email or username" value={identifier} onChangeText={edit(setIdentifier, 'identifier')}
            error={errors.identifier} placeholder="you@example.com" {...noStoreProps} keyboardType="email-address"
            returnKeyType="next" onSubmitEditing={() => goTo('password')} />
          <Notice icon="lock" text="Practice login. Nothing is checked, sent or stored. Do not use real credentials." />
        </React.Fragment>}
        {step === 'password' && <React.Fragment key="password">
          <Heading eyebrow="Step 2 of 2" title="Enter your password" body={`Logging in as ${identifier.trim()}. Use 8 to 128 characters.`} />
          <PasswordField testID="login-password" label="Password" value={password} onChangeText={edit(setPassword, 'password')}
            error={errors.password} returnKeyType="done" onSubmitEditing={submit} />
          <Notice icon="lock" text="Do not use a real password. Nothing you type is stored or sent." />
        </React.Fragment>}
        {step === 'passkey' && <React.Fragment key="passkey">
          <Heading eyebrow="Practice passkey" title="Confirm passkey login" body={`Continue as ${identifier.trim()} with a practice passkey.`} />
          <Notice icon="key" text="This is a dummy passkey step. No biometric, device prompt or real passkey is used, and nothing is verified, sent or stored." />
        </React.Fragment>}
      </StepTransition>
    </Shell>
  );
}
