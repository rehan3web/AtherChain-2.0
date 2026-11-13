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
import { CODE_LENGTH } from './demo';
import { userApi } from '@/services/api';
import { useBackendResource } from '@/hooks/useBackendResource';
import { CACHE_POLICIES } from '@/services/cache';
import { useToast } from '@/components/toast/ToastProvider';
import { BackendScreenState } from '@/components/BackendScreenState';

type Step = 'overview' | 'setup' | 'code' | 'disable';

export function TwoFaScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('overview');
  const [code, setCode] = useState('');
  const [phase, setPhase] = useState<Phase>('entry');
  const [disabledState, setDisabledState] = useState(false);
  const [secret, setSecret] = useState('');
  const pending = useRef(false);
  const { showToast } = useToast();
  const resource = useBackendResource(() => userApi.me({ force: true }), CACHE_POLICIES.twofa);
  const completed = resource.data?.twofa_enabled === true;
  useEffect(() => { if (resource.error) showToast({ kind: 'error', title: 'Two-factor authentication', body: resource.error }); }, [resource.error, showToast]);
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

  const verify = async (token: string) => {
    if (pending.current) return;
    pending.current = true;
    try {
      if (step === 'disable') await userApi.disable2FA(token);
      else await userApi.enable2FA(token);
      if (active.current) setPhase('success');
    } catch (cause) {
      if (active.current) {
        setPhase('error');
        showToast({ kind: 'error', title: 'Verification failed', body: cause instanceof Error ? cause.message : 'Please retry.' });
      }
    } finally { pending.current = false; }
  };
  const beginSetup = async () => {
    if (pending.current || resource.loading || completed || !resource.data) return;
    pending.current = true;
    try {
      const result = await userApi.generate2FA();
      if (!result.secret) throw new Error('The backend did not return an authenticator setup key.');
      setSecret(result.secret);
      setStep('setup');
    } catch (cause) {
      showToast({ kind: 'error', title: 'Could not start setup', body: cause instanceof Error ? cause.message : 'Please retry.' });
    } finally { pending.current = false; }
  };
  const onKey = (k: string) => {
    if (phase !== 'entry' || pending.current) return;
    if (k === BACKSPACE) { setCode(v => v.slice(0, -1)); return; }
    if (!/^\d$/.test(k) || code.length >= CODE_LENGTH) return;
    const next = code + k;
    setCode(next);
    if (next.length === CODE_LENGTH) void verify(next);
  };

  const currentOperation = operation.current;
  const onFinished = useCallback(() => {
    if (!active.current || currentOperation !== operation.current) return;
    if (phase === 'error') { setCode(''); setPhase('entry'); return; }
    if (phase === 'success' && step === 'disable') {
      setDisabledState(true);
      setCode(''); setPhase('entry');
      setStep('overview');
      return;
    }
    if (phase === 'success') {
      setSecret('');
      setDisabledState(false);
      setCode(''); setPhase('entry');
      setStep('overview');
    }
  }, [phase, step, currentOperation]);

  const top = (Platform.OS === 'web' ? 67 : insets.top) + 8;
  const bottom = Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0);
  const wrap = { paddingHorizontal: 24, maxWidth: 560, width: '100%' as const, alignSelf: 'center' as const };

  if (step === 'overview' && (resource.loading || resource.error || !resource.data)) {
    return <BackendScreenState testID="twofa-loading" error={resource.loading ? null : resource.error}
      onRetry={() => { void resource.reload(); }} onBack={exit} />;
  }
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
            <Heading eyebrow="Disable 2FA" title="Enter the authenticator code"
              body={'Enter the current six-digit code from your authenticator to disable account protection.'} />
          ) : (
            <>
              <Progress step={2} total={2} />
              <Heading eyebrow="Step 2 of 2" title="Enter the code"
                body={'Enter the current six-digit code from your authenticator. The server verifies it before enabling protection.'} />
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
            {step === 'overview' ? <OverviewStep completed={completed} disabled={disabledState} /> : <SetupStep secret={secret} uri={`otpauth://totp/${encodeURIComponent(`Ather Network: ${resource.data?.username ?? ''}`)}?secret=${encodeURIComponent(secret)}`} />}
          </ScrollView>
          <View style={[wrap, { paddingBottom: bottom, paddingTop: 8 }]}>
            {step === 'overview' ? (
              completed
                ? <PrimaryButton testID="twofa-disable" label="Disable 2FA" onPress={() => setConfirmOpen(true)} />
                : <PrimaryButton testID="twofa-enable" label="Enable 2FA" onPress={() => { void beginSetup(); }} />
            ) : (
              <PrimaryButton testID="twofa-next" label="Next" onPress={() => { cancel(); setStep('code'); }} />
            )}
          </View>
        </>
      )}

      <Sheet open={confirmOpen} title="Disable 2FA?" onClose={() => setConfirmOpen(false)} onExited={() => {}}>
        <Text style={[body, { marginBottom: 20 }]}>
          Confirm with a six-digit authenticator code. Disabling this protection changes your account security.
        </Text>
        <View style={{ gap: 10 }}>
          <PrimaryButton testID="twofa-disable-confirm" label="Disable 2FA" onPress={() => { setConfirmOpen(false); cancel(); setStep('disable'); }} />
          <PrimaryButton testID="twofa-disable-cancel" variant="ghost" label="Cancel" onPress={() => setConfirmOpen(false)} />
        </View>
      </Sheet>
    </View>
  );
}
