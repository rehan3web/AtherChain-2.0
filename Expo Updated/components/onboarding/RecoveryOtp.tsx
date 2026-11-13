import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Keyboard, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CodeCircles, type Phase } from '@/components/twofa/CodeCircles';
import { CODE_LENGTH } from '@/components/twofa/demo';
import { NumericKeypad } from '@/components/wallet/NumericKeypad';
import { BACKSPACE } from '@/components/wallet/format';
import { Heading, PrimaryButton } from '@/components/kyc/parts';
import { useToast } from '@/components/toast/ToastProvider';
import { Shell } from './Shell';

export function RecoveryOtp({ email, verify, resend, onVerified, onBack }: {
  email: string; verify: (code: string) => Promise<void>; resend: () => Promise<void>;
  onVerified: (code: string) => void; onBack: () => void;
}) {
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('entry');
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const busy = useRef(false), active = useRef(true), operation = useRef(0);
  const cancel = useCallback(() => {
    operation.current++; busy.current = false;
    setCode(''); setPhase('entry'); setSaving(false); setResending(false);
  }, []);
  useEffect(() => {
    Keyboard.dismiss();
    return () => { active.current = false; operation.current++; };
  }, []);
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; cancel(); };
  }, [cancel]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') cancel();
    });
    return () => sub.remove();
  }, [cancel]);
  const back = () => { if (!busy.current && phase === 'entry') { cancel(); onBack(); } };
  const backRef = useRef(back); backRef.current = back;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { backRef.current(); return true; });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const submit = async (otp: string) => {
    if (busy.current || phase !== 'entry' || otp.length !== CODE_LENGTH) return;
    const run = operation.current;
    busy.current = true; setSaving(true);
    try {
      await verify(otp);
      if (active.current && run === operation.current) setPhase('success');
    } catch (error) {
      if (active.current && run === operation.current) {
        showToast({ kind: 'error', title: 'Verification failed', body: error instanceof Error ? error.message : 'Please retry.' });
        setPhase('error');
      }
    } finally {
      if (active.current && run === operation.current) { busy.current = false; setSaving(false); }
    }
  };
  const onKey = (key: string) => {
    if (phase !== 'entry' || busy.current) return;
    if (key === BACKSPACE) { setCode(value => value.slice(0, -1)); return; }
    if (!/^\d$/.test(key) || code.length >= CODE_LENGTH) return;
    const next = code + key;
    setCode(next);
    if (next.length === CODE_LENGTH) void submit(next);
  };
  const sendAgain = async () => {
    if (busy.current || resendIn > 0 || phase !== 'entry') return;
    const run = operation.current;
    busy.current = true; setResending(true);
    try {
      await resend();
      if (!active.current || run !== operation.current) return;
      setCode(''); setResendIn(60);
      showToast({ kind: 'success', title: 'Code sent', body: 'Check your email for the new code.' });
    } catch (error) {
      if (active.current && run === operation.current)
        showToast({ kind: 'error', title: 'Could not send code', body: error instanceof Error ? error.message : 'Please retry.' });
    } finally {
      if (active.current && run === operation.current) { busy.current = false; setResending(false); }
    }
  };
  const run = operation.current;
  const onFinished = useCallback(() => {
    if (!active.current || run !== operation.current) return;
    if (phase === 'error') { setCode(''); setPhase('entry'); }
    else if (phase === 'success') onVerified(code);
  }, [phase, code, onVerified, run]);

  return <Shell testID="recovery-otp-screen" backID="recovery-otp-back" backLabel="Change recovery email" onBack={back} surface="wallet">
    <Heading eyebrow="Email verification" title="Enter the email code"
      body={`Enter the six-digit recovery code sent to ${email}.`} />
    <View style={{ flex: 1, minHeight: 100, justifyContent: 'center' }}>
      <CodeCircles filled={code.length} phase={phase} onFinished={onFinished} />
      {saving && <ActivityIndicator testID="recovery-verifying" accessibilityLabel="Verifying code"
        accessibilityRole="progressbar" accessibilityState={{ busy: true }} style={{ marginTop: 16 }} />}
    </View>
    <NumericKeypad hideDecimal testIDPrefix="recovery-key" onKey={onKey}
      disabled={saving || resending || phase !== 'entry'} onClear={() => { if (!busy.current && phase === 'entry') setCode(''); }} />
    <PrimaryButton testID="recovery-resend" variant="ghost" loading={resending}
      label={resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
      disabled={saving || phase !== 'entry' || resendIn > 0} onPress={() => { void sendAgain(); }} />
  </Shell>;
}
