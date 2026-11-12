import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Sheet } from '@/components/wallet/Sheet';
import { useToast } from '@/components/toast/ToastProvider';
import { PrimaryButton } from '@/components/kyc/parts';
import { useSessions, type Session } from './store';

type IconName = React.ComponentProps<typeof Feather>['name'];
const ICONS: Record<Session['platform'], IconName> = { android: 'smartphone', ios: 'smartphone', web: 'globe', other: 'monitor' };
const PLATFORM: Record<Session['platform'], string> = { android: 'Android', ios: 'iOS', web: 'Web', other: 'Other' };

function started(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Start time unknown';
  return `Started ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

type Confirm = { kind: 'one'; session: Session } | { kind: 'all' } | null;

export function SessionsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { sessions, signOutSession, signOutAll, error } = useSessions();
  const submitting = useRef(false);
  useEffect(() => { if (error) showToast({ kind: 'error', title: 'Sessions', body: error }); }, [error, showToast]);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [shown, setShown] = useState<Confirm>(null);

  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/settings'); };
  const ask = (next: NonNullable<Confirm>) => { setShown(next); setConfirm(next); };
  const close = () => setConfirm(null);

  const run = async () => {
    if (!shown || !confirm || submitting.current) return;
    submitting.current = true;
    try {
    if (shown.kind === 'one') {
      const ok = await signOutSession(shown.session.id);
      showToast(ok
        ? { kind: 'success', title: 'Session removed', body: `${shown.session.device} was signed out.` }
        : { kind: 'error', title: 'Session not found', body: 'It may already have been removed.' });
    } else {
      const n = await signOutAll();
      showToast({ kind: 'success', title: 'Sessions cleared', body: n === 1 ? '1 session was signed out.' : `${n} sessions were signed out.` });
    }
    close();
    } catch (cause) {
      showToast({ kind: 'error', title: 'Sign out failed', body: cause instanceof Error ? cause.message : 'Please retry.' });
    } finally { submitting.current = false; }
  };

  const top = (Platform.OS === 'web' ? 67 : insets.top) + 8;
  const bottom = Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0);
  const empty = sessions.length === 0;
  const body = { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, color: c.walletSubtle } as const;

  return (
    <View testID="sessions-screen" style={{ flex: 1, backgroundColor: c.background }}>
      <View style={{ paddingTop: top, paddingHorizontal: 12 }}>
        <Pressable testID="sessions-back" onPress={back} accessibilityRole="button" accessibilityLabel="Back"
          style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24, flexGrow: 1, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        <Text accessibilityRole="header" style={{ color: c.walletInk, fontFamily: 'DMSans_700Bold', fontSize: 30, letterSpacing: -0.8 }}>Sessions</Text>
        <Text style={[body, { marginTop: 10 }]}>
          Active sign-ins for your account. Signing out a session revokes its access on the server.
        </Text>

        {empty ? (
          <View testID="sessions-empty" style={{ marginTop: 48, alignItems: 'center', paddingHorizontal: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.walletField, alignItems: 'center', justifyContent: 'center' }}>
              <Feather name="monitor" size={26} color={c.walletMuted} />
            </View>
            <Text style={{ color: c.walletInk, fontFamily: 'DMSans_600SemiBold', fontSize: 18, marginTop: 18 }}>No sessions listed</Text>
            <Text style={[body, { textAlign: 'center', marginTop: 6 }]}>
              No active account sessions are listed.
            </Text>
          </View>
        ) : (
          <View style={{ marginTop: 28 }}>
            <Text style={{ color: c.walletInk, fontFamily: 'DMSans_600SemiBold', fontSize: 19, letterSpacing: -0.3, marginBottom: 6 }}>
              {sessions.length === 1 ? '1 session' : `${sessions.length} sessions`}
            </Text>
            {sessions.map((s, i) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 76 }}>
                <Feather name={ICONS[s.platform]} size={22} color={c.walletInk} style={{ width: 40 }} />
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', gap: 12, borderBottomWidth: i === sessions.length - 1 ? 0 : 1, borderBottomColor: c.walletField }}>
                  <View style={{ flex: 1, minWidth: 0, paddingVertical: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text numberOfLines={1} style={{ flexShrink: 1, color: c.walletInk, fontFamily: 'DMSans_500Medium', fontSize: 17 }}>{s.device}</Text>
                      {s.current && (
                        <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: c.walletField }}>
                          <Text style={{ color: c.walletInk, fontFamily: 'DMSans_600SemiBold', fontSize: 11, letterSpacing: 0.3 }}>THIS APP</Text>
                        </View>
                      )}
                    </View>
                    <Text numberOfLines={1} style={{ color: c.walletMuted, fontFamily: 'DMSans_400Regular', fontSize: 13, marginTop: 4 }}>
                      {PLATFORM[s.platform]} · {started(s.startedAt)}
                    </Text>
                  </View>
                  <Pressable testID={`sessions-sign-out-${s.id}`} onPress={() => ask({ kind: 'one', session: s })} hitSlop={6}
                    accessibilityRole="button" accessibilityLabel={`Sign out ${s.device}`}
                    style={({ pressed }) => [{ paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: pressed ? c.walletFieldPressed : c.walletField }, pressed && { transform: [{ scale: 0.96 }] }]}>
                    <Text style={{ color: c.walletError, fontFamily: 'DMSans_600SemiBold', fontSize: 14 }}>Sign out</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {!empty && (
        <View style={{ paddingHorizontal: 24, paddingBottom: bottom, paddingTop: 8, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
          <PrimaryButton testID="sessions-sign-out-all" label="Log out all sessions" onPress={() => ask({ kind: 'all' })} />
        </View>
      )}

      <Sheet open={confirm !== null} title={shown?.kind === 'all' ? 'Log out all sessions?' : 'Sign out session?'} onClose={close} onExited={() => setShown(null)}>
        <Text style={[body, { marginBottom: 20 }]}>
          {shown?.kind === 'all'
            ? `This signs out all ${sessions.length === 1 ? '1 session' : `${sessions.length} sessions`}, including this device.`
            : shown?.kind === 'one'
              ? `${shown.session.device}${shown.session.current ? ' (this app)' : ''} will be signed out of your account.`
              : ''}
        </Text>
        <View style={{ gap: 10 }}>
          <PrimaryButton testID="sessions-confirm" label={shown?.kind === 'all' ? 'Log out all sessions' : 'Sign out'} onPress={run} />
          <PrimaryButton variant="ghost" label="Cancel" onPress={close} />
        </View>
      </Sheet>
    </View>
  );
}
