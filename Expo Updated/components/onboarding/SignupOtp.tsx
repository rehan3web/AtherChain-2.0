import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Platform, Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { NumericKeypad } from '@/components/wallet/NumericKeypad';
import { BACKSPACE } from '@/components/wallet/format';
import { CodeCircles, type Phase } from '@/components/twofa/CodeCircles';
import { CODE_LENGTH } from '@/components/twofa/demo';
import { Heading, PrimaryButton, Progress } from '@/components/kyc/parts';
import { completeLogin } from './session';
import { authApi } from '@/services/api';
import { useToast } from '@/components/toast/ToastProvider';

/** OTP step. Code lives only in component state; `onDone` clears the parent draft. */
export function SignupOtp({ email, maskedEmail, onDone, onBack, cancelRef }: { email: string; maskedEmail: string; onBack: () => void; onDone: () => void; cancelRef: React.MutableRefObject<() => boolean> }) {
  const c = useColors();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('entry');
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(60);
  const active = useRef(true);
  const mounted = useRef(true);
  const operation = useRef(0);
  const busy = useRef(false);
  const verifiedToken = useRef<string | null>(null);

  const cancel = useCallback(() => {
    if (busy.current) return false; // An already-started local preference write must finish before back.
    operation.current++;
    verifiedToken.current = null;
    setPhase('entry'); setCode('');
    return true;
  }, []);
  cancelRef.current = cancel;
  useEffect(() => { Keyboard.dismiss(); }, []);
  useEffect(() => { mounted.current = true; active.current = true; return () => { mounted.current = false; active.current = false; operation.current++; }; }, []);
  useFocusEffect(useCallback(() => { active.current = true; Keyboard.dismiss(); return () => { active.current = false; cancel(); }; }, [cancel]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st !== 'active') cancel(); });
    return () => sub.remove();
  }, [cancel]);
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const verify = async (otp: string) => {
    if (busy.current || phase !== 'entry') return;
    const run = operation.current;
    busy.current = true; setSaving(true);
    try {
      if (!verifiedToken.current) {
        const result = await authApi.verifyEmail(email, otp);
        if (!active.current || run !== operation.current) return;
        if (!result.token) throw new Error('The backend did not return a verified session.');
        verifiedToken.current = result.token;
      }
      const token = verifiedToken.current;
      if (!token) throw new Error('The backend did not return a verified session.');
      await completeLogin(token);
      if (active.current && run === operation.current) setPhase('success');
    } catch (cause) {
      if (active.current && run === operation.current) {
        showToast({ kind: 'error', title: 'Verification failed', body: cause instanceof Error ? cause.message : 'Please try again.' });
        setPhase('error');
      }
    } finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  const onKey = (k: string) => {
    if (phase !== 'entry' || busy.current) return;
    if (k === BACKSPACE) { setCode(v => v.slice(0, -1)); return; }
    if (!/^\d$/.test(k) || code.length >= CODE_LENGTH) return;
    const next = code + k;
    setCode(next);
    if (next.length === CODE_LENGTH) void verify(next);
  };

  const resend = async () => {
    if (busy.current || resendIn > 0 || phase !== 'entry' || verifiedToken.current) return;
    busy.current = true; setResending(true);
    try {
      await authApi.resendOtp(email);
      if (!active.current) return;
      setCode(''); setResendIn(60);
      showToast({ kind: 'success', title: 'Code sent', body: 'Check your email for the new verification code.' });
    } catch (cause) {
      if (active.current) showToast({ kind: 'error', title: 'Could not send code', body: cause instanceof Error ? cause.message : 'Please try again.' });
    } finally {
      busy.current = false;
      if (mounted.current) setResending(false);
    }
  };

  const currentOperation = operation.current;
  const onFinished = useCallback(() => {
    if (!active.current || currentOperation !== operation.current) return;
    if (phase === 'error') { setCode(''); setPhase('entry'); return; }
    if (phase === 'success') { setCode(''); onDone(); router.replace('/'); }
  }, [phase, currentOperation, onDone]);

  const top = (Platform.OS === 'web' ? 67 : insets.top) + 8;
  const bottom = Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0);
  const wrap = { paddingHorizontal: 24, maxWidth: 560, width: '100%' as const, alignSelf: 'center' as const };

  return (
    <View testID="signup-screen" style={{ flex: 1, backgroundColor: c.miningPage ?? c.background }}>
      <View style={{ paddingTop: top, paddingHorizontal: 12 }}>
        <Pressable testID="signup-back" onPress={onBack} accessibilityRole="button" accessibilityLabel="Previous step"
          style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>
      <ScrollView testID="signup-step-otp" style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        contentContainerStyle={[wrap, { flexGrow: 1, paddingTop: 8, paddingBottom: bottom }]}>
        <Progress step={8} total={8} />
        <Heading eyebrow="Step 8 of 8" title="Enter the email code"
          body={`Enter the six-digit verification code sent to ${maskedEmail}. Only the code sent by AtherChain will be accepted.`} />
        <View style={{ flex: 1, minHeight: 100, justifyContent: 'center' }}>
          <CodeCircles filled={code.length} phase={phase} onFinished={onFinished} />
          <PrimaryButton testID="signup-verify" label={verifiedToken.current ? 'Continue' : 'Verify email'}
            loading={saving} disabled={resending || phase !== 'entry' || (!verifiedToken.current && code.length !== CODE_LENGTH)}
            onPress={() => { void verify(code); }} />
        </View>
        <NumericKeypad hideDecimal testIDPrefix="signup-key" disabled={phase !== 'entry' || saving || resending} onKey={onKey}
          onClear={() => phase === 'entry' && setCode('')} />
        <PrimaryButton testID="signup-resend" variant="ghost" loading={resending}
          label={resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
          disabled={saving || phase !== 'entry' || resendIn > 0 || !!verifiedToken.current} onPress={() => { void resend(); }} />
      </ScrollView>
    </View>
  );
}
