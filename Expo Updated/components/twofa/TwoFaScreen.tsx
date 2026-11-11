import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { NumericKeypad } from '@/components/wallet/NumericKeypad';
import { BACKSPACE } from '@/components/wallet/format';
import { Heading, PrimaryButton, Progress, s } from '@/components/kyc/parts';
import { CodeCircles, type Phase } from './CodeCircles';
import { OverviewStep, SetupStep } from './Steps';
import { Sheet } from '@/components/wallet/Sheet';
import { CODE_LENGTH, DEMO_REJECT_CODE, isDemoCompleted, isDemoDisabled, markDemoCompleted, markDemoDisabled } from './demo';

type Step = 'overview' | 'setup' | 'code' | 'disable';

export function TwoFaScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('overview');
  const [completed, setCompleted] = useState(isDemoCompleted);
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('entry');
  const [disabledState, setDisabledState] = useState(isDemoDisabled);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const active = useRef(true);
  const operation = useRef(0);
  const body = { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: c.walletSubtle } as const;

  // Any interruption cancels in-flight animation (CodeCircles stops on phase reset) and clears the code.
  const cancel = useCallback(() => { operation.current++; setPhase('entry'); setCode(''); }, []);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useFocusEffect(useCallback(() => {
    active.current = true;
    return () => { active.current = false; cancel(); };
  }, [cancel]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => { if (st !== 'active') cancel(); });
    return () => sub.remove();
  }, [cancel]);

  const exit = useCallback(() => {
    active.current = false;
    cancel();
    if (router.canGoBack()) router.back(); else router.replace('/(tabs)/settings');
  }, [cancel]);

  const goBack = useCallback(() => {
    cancel();
    if (step === 'disable') setStep('overview');
    else if (step === 'code') setStep('setup');
    else if (step === 'setup') setStep('overview');
    else exit();
  }, [step, cancel, exit]);
  const goBackRef = useRef(goBack);
  goBackRef.current = goBack;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { goBackRef.current(); return true; });
    return () => sub.remove();
  }, []);

  const onKey = (k: string) => {
    if (phase !== 'entry') return;
    if (k === BACKSPACE) { setCode(v => v.slice(0, -1)); return; }
    if (!/^\d$/.test(k) || code.length >= CODE_LENGTH) return;
    const next = code + k;
    setCode(next);
    if (next.length === CODE_LENGTH) setPhase(next === DEMO_REJECT_CODE ? 'error' : 'success');
  };

  const currentOperation = operation.current;
  const onFinished = useCallback(() => {
    if (!active.current || currentOperation !== operation.current) return;
    if (phase === 'error') { setCode(''); setPhase('entry'); return; }
    if (phase === 'success' && step === 'disable') {
      markDemoDisabled();
      setCompleted(false); setDisabledState(true);
      setCode(''); setPhase('entry');
      setStep('overview');
      return;
    }
    if (phase === 'success') {
      markDemoCompleted();
      setDisabledState(false);
      setCompleted(true);
      setCode(''); setPhase('entry');
      setStep('overview');
    }
  }, [phase, step, currentOperation]);

  const top = (Platform.OS === 'web' ? 67 : insets.top) + 8;
  const bottom = Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0);
  const wrap = { paddingHorizontal: 24, maxWidth: 560, width: '100%' as const, alignSelf: 'center' as const };

  return (
    <View testID="twofa-screen" style={{ flex: 1, backgroundColor: c.miningPage ?? c.background }}>
      <View style={{ paddingTop: top, paddingHorizontal: 12 }}>
        <Pressable testID="twofa-back" onPress={goBack} accessibilityRole="button"
          accessibilityLabel={step === 'overview' ? 'Close two-factor setup' : 'Back'}
          style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>

      {step === 'code' || step === 'disable' ? (
        <ScrollView testID={step === 'disable' ? 'twofa-step-disable-code' : 'twofa-step-code'} style={{ flex: 1 }} showsVerticalScrollIndicator={false}
          contentContainerStyle={[wrap, { flexGrow: 1, paddingTop: 8, paddingBottom: bottom }]}>
          {step === 'disable' ? (
            <Heading eyebrow="Disable 2FA" title="Enter the email code"
              body={'Practice email verification. No email is sent. Any six digits pass except 123456. Account security is unchanged.'} />
          ) : (
            <>
              <Progress step={2} total={2} />
              <Heading eyebrow="Step 2 of 2" title="Enter the code"
                body={'Practice setup only. Any six digits pass; try 123456 to see a rejected code.'} />
            </>
          )}
          <View style={{ flex: 1, minHeight: 100, justifyContent: 'center' }}>
            <CodeCircles filled={code.length} phase={phase} onFinished={onFinished} />
            <Text accessibilityLiveRegion="polite" style={[s.rowSub, { textAlign: 'center', marginTop: 4, minHeight: 18, color: phase === 'error' ? c.walletError : phase === 'success' ? c.walletPositive : c.walletSubtle }]}>
              {phase === 'error' ? 'That code did not match. Try again.' : phase === 'success' ? 'Verified' : ''}
            </Text>
          </View>
          <NumericKeypad hideDecimal testIDPrefix="twofa-key" disabled={phase !== 'entry'} onKey={onKey}
            onClear={() => phase === 'entry' && setCode('')} />
        </ScrollView>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[wrap, { paddingTop: 8, paddingBottom: 24, flexGrow: 1 }]}>
            {step === 'setup' && <Progress step={1} total={2} />}
            {step === 'overview' ? <OverviewStep completed={completed} disabled={disabledState} /> : <SetupStep />}
          </ScrollView>
          <View style={[wrap, { paddingBottom: bottom, paddingTop: 8 }]}>
            {step === 'overview' ? (
              completed
                ? <PrimaryButton testID="twofa-disable" label="Disable 2FA" onPress={() => setConfirmOpen(true)} />
                : <PrimaryButton testID="twofa-enable" label="Enable 2FA" onPress={() => setStep('setup')} />
            ) : (
              <PrimaryButton testID="twofa-next" label="Next" onPress={() => { cancel(); setStep('code'); }} />
            )}
          </View>
        </>
      )}

      <Sheet open={confirmOpen} title="Disable 2FA?" onClose={() => setConfirmOpen(false)} onExited={() => {}}>
        <Text style={[body, { marginBottom: 20 }]}>
          You will confirm with a six-digit email code. This is practice only; no email is sent and account security is unchanged.
        </Text>
        <View style={{ gap: 10 }}>
          <PrimaryButton testID="twofa-disable-confirm" label="Disable 2FA" onPress={() => { setConfirmOpen(false); cancel(); setStep('disable'); }} />
          <PrimaryButton testID="twofa-disable-cancel" variant="ghost" label="Cancel" onPress={() => setConfirmOpen(false)} />
        </View>
      </Sheet>
    </View>
  );
}
