import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useToast } from '@/components/toast/ToastContext';
import { copyText } from '@/utils/clipboard';
import { Heading, Row, s } from '@/components/kyc/parts';
import { DemoQr } from './DemoQr';
import { TwoFaIllustration } from './Illustration';
import { DEMO_SECRET, DEMO_URI, groupedSecret } from './demo';

export function OverviewStep({ completed, disabled = false }: { completed: boolean; disabled?: boolean }) {
  const c = useColors();
  return (
    <View testID="twofa-step-overview">
      <TwoFaIllustration completed={completed} />
      <Heading title="Two-factor authentication"
        body="See how an authenticator app adds a second step to sign-in. Practice setup only. Account security is unchanged." />
      <View testID="twofa-status" accessibilityLabel={completed ? 'Status: completed this session' : disabled ? 'Status: disabled this session' : 'Status: not set up'}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, backgroundColor: completed ? c.walletPositiveSoft : c.walletField, marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={[s.rowTitle, { color: completed ? c.walletPositive : c.walletInk }]}>{completed ? 'Completed' : disabled ? 'Disabled' : 'Not set up'}</Text>
          <Text style={[s.rowSub, { color: c.walletSubtle }]}>{completed ? 'Walkthrough finished this session. Your sign-in is unchanged.' : disabled ? 'Turned off this session. Your sign-in is unchanged.' : 'Takes under a minute. No real codes needed.'}</Text>
        </View>
      </View>
      <Row icon="smartphone" title="Scan a QR code" sub="Your authenticator would read a shared key." />
      <Row icon="hash" title="Enter a six-digit code" sub="Proves the app and the account agree." />
      <Row icon="shield" title="Sign in with both" sub="Password plus code, every time." />
    </View>
  );
}

export function SetupStep() {
  const c = useColors();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  const copy = async () => {
    try {
      await copyText(DEMO_SECRET);
      setCopied(true);
      showToast({ kind: 'success', title: 'Key copied', body: 'Practice key only. Account security is unchanged.' });
      if (t.current) clearTimeout(t.current);
      t.current = setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast({ kind: 'error', title: 'Could not copy key', body: 'Please try again.' });
    }
  };
  return (
    <View testID="twofa-step-setup">
      <Heading eyebrow="Step 1 of 2" title="Scan the QR code"
        body="Practice setup only. Account security is unchanged. Scanning is optional." />
      <DemoQr value={DEMO_URI} />
      <Text style={[s.label, { color: c.walletSubtle, textAlign: 'center', marginTop: 22 }]}>Setup key</Text>
      <Pressable testID="twofa-copy-key" onPress={copy} accessibilityRole="button"
        accessibilityLabel={`Copy setup key ${DEMO_SECRET}`} accessibilityHint="Copies the practice setup key to your clipboard"
        style={({ pressed }) => [{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16, borderRadius: 16, backgroundColor: pressed ? c.walletFieldPressed : c.walletField }, pressed && { transform: [{ scale: 0.98 }] }]}>
        <Text selectable numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0, color: c.walletInk, fontFamily: 'DMSans_500Medium', fontSize: 15, letterSpacing: 1, fontVariant: ['tabular-nums'] }}>{groupedSecret}</Text>
        <Feather name={copied ? 'check' : 'copy'} size={18} color={copied ? c.walletPositive : c.walletSubtle} />
      </Pressable>
    </View>
  );
}
