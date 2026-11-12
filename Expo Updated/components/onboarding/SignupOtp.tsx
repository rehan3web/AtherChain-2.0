import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { NumericKeypad } from '@/components/wallet/NumericKeypad';
import { BACKSPACE } from '@/components/wallet/format';
import { CodeCircles, type Phase } from '@/components/twofa/CodeCircles';
import { CODE_LENGTH } from '@/components/twofa/demo';
import { Heading, PrimaryButton, Progress, s } from '@/components/kyc/parts';
import { completeLogin } from './session';
import { authApi } from '@/services/api';

/** OTP step. Code lives only in component state; `onDone` clears the parent draft. */
export function SignupOtp({ email, maskedEmail, onDone, onBack, cancelRef }: { email: string; maskedEmail: string; onBack: () => void; onDone: () => void; cancelRef: React.MutableRefObject<() => boolean> }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('entry');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const active = useRef(true);
  const operation = useRef(0);
  const busy = useRef(false);
  const verifiedToken = useRef<string | null>(null);

  const cancel = useCallback(() => {
    operation.current++;
    if (busy.current) return false; // An already-started local preference write must finish before back.
    setPhase('entry'); setCode(''); setSaveError(null);
    return true;
  }, []);
  cancelRef.current = cancel;
  useEffect(() => { Keyboard.dismiss(); }, []);
  useEffect(() => { active.current = true; return () => { active.current = false; operation.current++; }; }, []);
  useFocusEffect(useCallback(() => { active.current = true; Keyboard.dismiss(); return () => { active.current = false; cancel(); }; }, [cancel]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st !== 'active') cancel(); });
    return () => sub.remove();
  }, [cancel]);

  const verify = async (otp: string) => {
    const run = operation.current;
    busy.current = true; setSaving(true); setSaveError(null);
    try {
      const result = await authApi.verifyEmail(email, otp);
      if (!active.current || run !== operation.current) return;
      if (!result.token) throw new Error('The backend did not return a verified session.');
      verifiedToken.current = result.token;
      if (active.current) setPhase('success');
    } catch (cause) {
      if (active.current) {
        setSaveError(cause instanceof Error ? cause.message : 'Email verification failed.');
        setPhase('error');
      }
    } finally { busy.current = false; if (active.current) setSaving(false); }
  };
  const onKey = (k: string) => {
    if (phase !== 'entry' || busy.current) return;
    if (k === BACKSPACE) { setCode(v => v.slice(0, -1)); return; }
    if (!/^\d$/.test(k) || code.length >= CODE_LENGTH) return;
    const next = code + k;
    setCode(next);
    if (next.length === CODE_LENGTH) void verify(next);
  };

  const save = useCallback(async () => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setSaveError(null);
    try {
      if (!verifiedToken.current) {
        busy.current = false;
        setSaving(false);
        await verify(code);
        return;
      }
      await completeLogin(verifiedToken.current);
      if (!active.current) return;
      setCode('');
      onDone();
      router.replace('/');
    } catch (cause) {
      if (active.current) setSaveError(cause instanceof Error ? cause.message : 'Could not open your account. Please retry.');
    } finally {
      busy.current = false;
      if (active.current) setSaving(false);
    }
  }, [onDone, code, email]);

  const currentOperation = operation.current;
  const onFinished = useCallback(() => {
    if (!active.current || currentOperation !== operation.current) return;
    if (phase === 'error') { setCode(''); setPhase('entry'); return; }
    if (phase === 'success') save();
  }, [phase, currentOperation, save]);

  const msg = saveError ?? (saving ? 'Opening…' : phase === 'error' ? 'That code did not match. Try again.' : phase === 'success' ? 'Verified' : '');
  const msgColor = saveError || phase === 'error' ? c.walletError : phase === 'success' ? c.walletPositive : c.walletSubtle;

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
          <Text accessibilityLiveRegion="polite" style={[s.rowSub, { textAlign: 'center', marginTop: 4, minHeight: 18, color: msgColor }]}>{msg}</Text>
          {!!saveError && <View style={{ marginTop: 12 }}><PrimaryButton testID="signup-retry" label="Retry" onPress={save} /></View>}
        </View>
        <NumericKeypad hideDecimal testIDPrefix="signup-key" disabled={phase !== 'entry' || saving} onKey={onKey}
          onClear={() => phase === 'entry' && setCode('')} />
      </ScrollView>
    </View>
  );
}
