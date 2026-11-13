import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Keyboard } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { authApi } from '@/services/api';
import { Heading, PrimaryButton } from '@/components/kyc/parts';
import { useToast } from '@/components/toast/ToastProvider';
import { AuthField, PasswordField, noStoreProps } from './SignupFields';
import { Shell } from './Shell';
import { RecoveryOtp } from './RecoveryOtp';
import { maskSignupEmail } from './model';

export type RecoveryKind = 'password' | 'twofa';
export function RecoveryScreen({ kind, initialEmail, onBack, onDone }: {
  kind: RecoveryKind; initialEmail: string; onBack: () => void; onDone: () => void;
}) {
  const { showToast } = useToast();
  const [step, setStep] = useState<'email' | 'otp' | 'password'>('email');
  const [email, setEmail] = useState(initialEmail.includes('@') ? initialEmail : '');
  const [userId, setUserId] = useState('');
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const busy = useRef(false), active = useRef(true), operation = useRef(0);
  useEffect(() => () => { active.current = false; operation.current++; }, []);
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; operation.current++; };
  }, []));
  const back = () => {
    if (busy.current) return;
    Keyboard.dismiss();
    if (step === 'email') onBack();
    else { operation.current++; setToken(''); setPassword(''); setConfirmation(''); setStep('email'); }
  };
  const backRef = useRef(back); backRef.current = back;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { backRef.current(); return true; });
    return () => sub.remove();
  }, []);
  const confirmed = (result: any) => {
    if (result?.success === false || typeof result?.message !== 'string' || !result.message)
      throw new Error('The backend did not confirm the recovery request. Please retry.');
  };
  const send = async () => {
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254)
      throw new Error('Enter a valid email address.');
    const result = kind === 'password'
      ? await authApi.forgotPassword(value) : await authApi.start2FARecovery(value);
    confirmed(result);
    if (kind === 'twofa' && (typeof result.userId !== 'string' || !result.userId))
      throw new Error('The backend did not return a recovery account. Please retry.');
    return { email: value, userId: kind === 'twofa' ? result.userId : '' };
  };
  const next = async () => {
    if (busy.current) return;
    const run = operation.current;
    busy.current = true; setSaving(true); Keyboard.dismiss();
    try {
      const result = await send();
      if (!active.current || run !== operation.current) return;
      setEmail(result.email); setUserId(result.userId); setStep('otp');
    } catch (error) {
      if (active.current && run === operation.current)
        showToast({ kind: 'error', title: 'Could not send code', body: error instanceof Error ? error.message : 'Please retry.' });
    } finally {
      if (active.current && run === operation.current) { busy.current = false; setSaving(false); }
    }
  };
  const finish = () => {
    setToken(''); setPassword(''); setConfirmation('');
    showToast({ kind: 'success', title: kind === 'password' ? 'Password reset' : '2FA reset',
      body: 'Please log in again with your account.' });
    onDone();
  };
  const resetPassword = async () => {
    if (busy.current) return;
    if (password.trim().length < 8 || password.length > 128 || password !== confirmation) {
      showToast({ kind: 'error', title: 'Check your password',
        body: password !== confirmation ? 'Passwords must match.' : 'Use a password with 8–128 characters.' });
      return;
    }
    const run = operation.current;
    busy.current = true; setSaving(true); Keyboard.dismiss();
    try {
      confirmed(await authApi.resetPassword(email, token, password));
      if (active.current && run === operation.current) finish();
    } catch (error) {
      if (active.current && run === operation.current)
        showToast({ kind: 'error', title: 'Password reset failed', body: error instanceof Error ? error.message : 'Please retry.' });
    } finally {
      if (active.current && run === operation.current) { busy.current = false; setSaving(false); }
    }
  };

  if (step === 'otp') return <RecoveryOtp email={maskSignupEmail(email)}
    verify={async code => {
      const result = kind === 'password'
        ? await authApi.verifyResetOTP(email, code) : await authApi.verify2FARecovery(userId, code);
      confirmed(result);
    }}
    resend={async () => {
      const result = await send();
      if (active.current) setUserId(result.userId);
    }}
    onVerified={code => {
      if (kind === 'twofa') finish();
      else { setToken(code); setStep('password'); }
    }} onBack={back} />;

  return <Shell testID="recovery-screen" backID="recovery-back" backLabel="Back to login" onBack={back}
    footer={<PrimaryButton testID="recovery-next" label={step === 'email' ? 'Next' : 'Reset password'}
      loading={saving} disabled={saving} onPress={() => { void (step === 'email' ? next() : resetPassword()); }} />}>
    {step === 'email' ? <>
      <Heading eyebrow="Account recovery" title={kind === 'password' ? 'Forgot password' : 'Reset 2FA'}
        body={kind === 'password' ? 'Enter your account email to receive a password reset code.'
          : 'Verify your account email to reset 2FA. You will need to log in again afterwards.'} />
      <AuthField testID="recovery-email" label="Email" value={email} onChangeText={setEmail}
        editable={!saving} {...noStoreProps} keyboardType="email-address" placeholder="you@example.com"
        returnKeyType="next" onSubmitEditing={() => { void next(); }} />
    </> : <>
      <Heading eyebrow="New password" title="Reset your password" body="Choose a new password with 8–128 characters." />
      <PasswordField testID="recovery-password" label="New password" value={password} onChangeText={setPassword}
        editable={!saving} maxLength={128} />
      <PasswordField testID="recovery-confirm-password" label="Confirm password" value={confirmation} onChangeText={setConfirmation}
        editable={!saving} maxLength={128} returnKeyType="done" onSubmitEditing={() => { void resetPassword(); }} />
    </>}
  </Shell>;
}
