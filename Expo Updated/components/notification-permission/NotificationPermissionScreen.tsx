import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { PrimaryButton } from '@/components/kyc/parts';
import { WRAP, useInsets } from '@/components/onboarding/Shell';
import { NotificationIllustration } from './NotificationIllustration';
import type { NotificationGateState } from './model';

export function NotificationPermissionScreen({ state, onAllow, onRetry }: {
  state: NotificationGateState; onAllow: () => void; onRetry: () => void;
}) {
  const c = useColors();
  const { scheme } = useTheme();
  const { top, bottom } = useInsets();
  const checking = state.phase === 'checking';
  return <View testID="notification-permission-screen" style={[s.page, { backgroundColor: c.miningPage ?? c.background, paddingTop: top }]}>
    <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
    <ScrollView testID="notification-permission-scroll" showsVerticalScrollIndicator={false}
      contentContainerStyle={[WRAP, s.content]}>
      <NotificationIllustration />
      <Text accessibilityRole="header" style={[s.title, { color: c.walletInk }]}>Please Allow Notifications</Text>
      <Text style={[s.body, { color: c.walletSubtle }]}>
        Enable notifications in your phone settings to continue to AtherChain.
      </Text>
      <Text style={[s.help, { color: c.walletSubtle, marginTop: 12 }]}>
        Open Settings, choose Notifications, then turn on Allow Notifications. Return here when you’re done.
      </Text>
      {checking && <View style={s.checking} accessibilityLiveRegion="polite">
        <ActivityIndicator color={c.walletInk} />
        <Text style={[s.help, { color: c.walletSubtle }]}>Checking notification permission…</Text>
      </View>}
      {!!state.error && <View style={s.error}>
        <Text testID="notification-permission-error" accessibilityRole="alert" style={[s.help, { color: c.walletError }]}>{state.error}</Text>
        <Pressable testID="notification-permission-retry" onPress={onRetry} disabled={state.busy}
          accessibilityRole="button" accessibilityLabel="Retry checking notification permission" style={s.retry}>
          <Text style={[s.retryText, { color: c.walletInk }]}>Try again</Text>
        </Pressable>
      </View>}
    </ScrollView>
    <View style={[WRAP, { paddingTop: 12, paddingBottom: bottom }]}>
      <PrimaryButton testID="notification-permission-allow" label="Allow Notifications" onPress={onAllow} disabled={checking || state.busy} />
    </View>
  </View>;
}

const s = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 24, alignItems: 'center' },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 28, lineHeight: 34, letterSpacing: -0.6, textAlign: 'center', marginTop: 24 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 14 },
  help: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  checking: { alignItems: 'center', gap: 10, marginTop: 20 },
  error: { alignItems: 'center', marginTop: 20 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  retryText: { fontFamily: 'DMSans_600SemiBold', fontSize: 14 },
});
