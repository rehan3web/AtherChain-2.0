import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Sheet } from '@/components/wallet/Sheet';
import { useToast } from '@/components/toast/ToastProvider';
import { Heading, PrimaryButton, Row } from '@/components/kyc/parts';
import { PasskeyIllustration } from './Illustration';
import { usePasskeys, type Passkey } from './store';

type IconName = React.ComponentProps<typeof Feather>['name'];
const ICONS: Record<Passkey['platform'], IconName> = { android: 'smartphone', ios: 'smartphone', web: 'globe', other: 'monitor' };
const PLATFORM: Record<Passkey['platform'], string> = { android: 'Android', ios: 'iOS', web: 'Web', other: 'Other' };

function created(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Creation time unknown';
  return `Created ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

export function PasskeysScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { passkeys, createPasskey, deletePasskey } = usePasskeys();
  const [confirm, setConfirm] = useState<Passkey | null>(null);
  const [shown, setShown] = useState<Passkey | null>(null);

  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/settings'); };
  const ask = (p: Passkey) => { setShown(p); setConfirm(p); };
  const close = () => setConfirm(null);

  const create = () => {
    const p = createPasskey();
    showToast({ kind: 'success', title: 'Passkey added', body: `${p.device} was added. Practice only; sign-in is unchanged.` });
  };

  const run = () => {
    if (!shown || !confirm) return;
    const ok = deletePasskey(shown.id);
    showToast(ok
      ? { kind: 'success', title: 'Passkey deleted', body: `${shown.device} was removed from this list.` }
      : { kind: 'error', title: 'Passkey not found', body: 'It may already have been deleted.' });
    close();
  };

  const top = (Platform.OS === 'web' ? 67 : insets.top) + 8;
  const bottom = Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0);
  const empty = passkeys.length === 0;
  const body = { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: c.walletSubtle } as const;

  return (
    <View testID="passkeys-screen" style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: top, paddingHorizontal: 12 }}>
        <Pressable testID="passkeys-back" onPress={back} accessibilityRole="button" accessibilityLabel="Back"
          style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, flexGrow: 1, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        {empty ? (
          <View testID="passkeys-onboarding">
            <PasskeyIllustration />
            <Heading title="Passkeys"
              body="See how a passkey lets you sign in without a password. Practice setup only. No device credential is created and sign-in is unchanged." />
            <Row icon="key" title="One key per device" sub="Each device would hold its own private key." />
            <Row icon="unlock" title="No password to type" sub="Your screen lock would confirm it is you." />
            <Row icon="shield" title="Hard to phish" sub="Keys only work on the site that made them." />
          </View>
        ) : (
          <View testID="passkeys-list">
            <Text accessibilityRole="header" style={{ color: c.walletInk, fontFamily: 'DMSans_700Bold', fontSize: 30, letterSpacing: -0.8 }}>Passkeys</Text>
            <Text style={[body, { marginTop: 10 }]}>
              Practice passkeys for this app. They are not real device credentials and reset when the app restarts.
            </Text>
            <Text style={{ color: c.walletInk, fontFamily: 'DMSans_600SemiBold', fontSize: 19, letterSpacing: -0.3, marginTop: 28, marginBottom: 6 }}>
              {passkeys.length === 1 ? '1 passkey' : `${passkeys.length} passkeys`}
            </Text>
            {passkeys.map((p, i) => (
              <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 76 }}>
                <Feather name={ICONS[p.platform]} size={22} color={c.walletInk} style={{ width: 40 }} />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 12, borderBottomWidth: i === passkeys.length - 1 ? 0 : 1, borderBottomColor: c.walletField }}>
                  <View style={{ flex: 1, minWidth: 0, paddingVertical: 14 }}>
                    <Text numberOfLines={1} style={{ color: c.walletInk, fontFamily: 'DMSans_500Medium', fontSize: 17 }}>{p.device}</Text>
                    <Text numberOfLines={1} style={{ color: c.walletMuted, fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 4 }}>
                      {PLATFORM[p.platform]} · {created(p.createdAt)}
                    </Text>
                  </View>
                  <Pressable testID={`passkeys-delete-${p.id}`} onPress={() => ask(p)} hitSlop={6}
                    accessibilityRole="button" accessibilityLabel={`Delete passkey ${p.device}`}
                    style={({ pressed }) => [{ paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: pressed ? c.walletFieldPressed : c.walletField }, pressed && { transform: [{ scale: 0.96 }] }]}>
                    <Text style={{ color: c.walletError, fontFamily: 'DMSans_600SemiBold', fontSize: 14 }}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: bottom, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        {empty
          ? <PrimaryButton testID="passkeys-create" label="Create passkey" onPress={create} />
          : <PrimaryButton testID="passkeys-add" label="Add new passkey" onPress={create} />}
      </View>

      <Sheet open={confirm !== null} title="Delete passkey?" onClose={close} onExited={() => setShown(null)}>
        <Text style={[body, { marginBottom: 20 }]}>
          {shown ? `${shown.device} will be removed from this list. No real device credential or sign-in is affected.` : ''}
        </Text>
        <View style={{ gap: 10 }}>
          <PrimaryButton testID="passkeys-confirm" label="Delete passkey" onPress={run} />
          <PrimaryButton testID="passkeys-cancel" variant="ghost" label="Cancel" onPress={close} />
        </View>
      </Sheet>
    </View>
  );
}
