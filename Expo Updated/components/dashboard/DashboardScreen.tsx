import React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useDockClearance } from '@/components/navigation/GlassDock';
import { useMining } from '@/components/mining/useMining';
import { RefillMeter } from '@/components/mining/RefillMeter';
import { useProfile } from '@/components/settings/profile';
import { ScalePressable } from '@/components/wallet/primitives';
import { RecentActivity } from './RecentActivity';
import { useTheme } from '@/hooks/useTheme';

const PANELS = {
  statistics: { title: 'Statistics', icon: 'bar-chart-2', heading: 'Mining statistics', body: '' },
  referral: { title: 'Referral', icon: 'users', heading: 'Invite your community', body: '' },
  news: { title: 'News', icon: 'file-text', heading: 'AtherChain news', body: '' },
  help: { title: 'Help', icon: 'help-circle', heading: 'How can we help?', body: 'Guides and support will be available here. This is a demo preview.' },
  scan: { title: 'Scan', icon: 'maximize', heading: '', body: '' },
  notifications: { title: 'Notifications', icon: 'bell', heading: '', body: '' },
} as const;
type Panel = keyof typeof PANELS;
const SHORTCUTS: Panel[] = ['statistics', 'referral', 'news', 'help'];
const number = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
// Display-only demo total; no strike accrual is implemented.
const DEMO_STRIKE_AT = 0;

export function DashboardScreen() {
  const c = useColors();
  const { error: themeError } = useTheme();
  const router = useRouter();
  const { profile } = useProfile();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { clearance } = useDockClearance();
  const { snapshot, loading, error, retry } = useMining();
  const show = (next: Panel) => {
    if (next === 'statistics') { router.push('/statistics'); return; }
    if (next === 'referral') { router.push('/referral'); return; }
    if (next === 'news') { router.push('/news'); return; }
    if (next === 'help') { router.push('/help'); return; }
    if (next === 'scan') { router.push('/scan'); return; }
    if (next === 'notifications') { router.push('/notifications'); return; }
  };
  const ready = !loading && !error && snapshot;
  return (
    <LinearGradient colors={[c.walletCardTop, c.walletCardBottom]} style={styles.page}>
      <ScrollView
        testID="screen-dashboard"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: clearance + 20 }]}
      >
        <View style={[styles.header, { backgroundColor: c.walletCardTop, paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 16 }]}>
          <View style={styles.profile}>
            <LinearGradient
              testID="dashboard-gradient-avatar"
              colors={['#f69a27', '#db5380', '#b700d6']}
              locations={[0, .5, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            />
            <View style={styles.nameWrap}>
              <Text numberOfLines={1} style={[styles.greeting, { color: c.walletSubtle }]}>Welcome back</Text>
              <Text numberOfLines={1} style={[styles.name, { color: c.walletInk }]}>{profile.name}</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            {(['scan', 'notifications'] as const).map(key => (
              <Pressable key={key} testID={`dashboard-${key}`} onPress={() => show(key)} accessibilityRole="button" accessibilityLabel={PANELS[key].title} style={({ pressed }) => [styles.headerButton, pressed && { backgroundColor: c.walletFieldPressed }]}>
                <Feather name={PANELS[key].icon} size={22} color={c.walletInk} />
              </Pressable>
            ))}
          </View>
        </View>
        {themeError && <Text accessibilityRole="alert" style={[styles.note, { color: c.walletError, paddingHorizontal: 20, paddingVertical: 8 }]}>{themeError}</Text>}

        <View testID="dashboard-balance-summary" style={styles.balanceContent}>
          <Text style={[styles.balanceLabelText, { color: c.dashboardBalance }]}>Total AT Balance</Text>
          <View style={styles.amountRow}>
            {loading ? <ActivityIndicator testID="dashboard-balance-loading" color={c.walletInk} /> : (
              <Text
                testID="dashboard-total-balance"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.balance, { fontSize: Math.min(48, width * .12), color: c.dashboardBalance }]}
              >{ready ? number.format(snapshot.totalBalance) : '—'}</Text>
            )}
            <Text style={[styles.unit, { color: c.dashboardBalance }]}>AT</Text>
          </View>
          <View style={styles.strike}>
            <Feather name="trending-up" size={16} color={c.walletMuted} />
            <Text style={[styles.strikeLabel, { color: c.walletSubtle }]}>Total strike</Text>
            <Text testID="dashboard-total-strike" style={[styles.strikeValue, { color: c.walletSubtle }]}>{number.format(DEMO_STRIKE_AT)} AT</Text>
          </View>
        </View>
        {error && (
          <View style={styles.error}>
            <Text accessibilityRole="alert" style={[styles.note, { color: c.walletError }]}>{error}</Text>
            <Pressable onPress={retry} accessibilityRole="button" accessibilityLabel="Retry dashboard balances" style={styles.retry}><Text style={[styles.shortcutLabel, { color: c.walletInk }]}>Try again</Text></Pressable>
          </View>
        )}

        <View style={styles.shortcutsSection}>
          <Text style={[styles.sectionTitle, { color: c.walletInk }]}>Shortcuts</Text>
          <View style={styles.shortcuts}>
            {SHORTCUTS.map(key => (
              <ScalePressable key={key} testID={`dashboard-${key}`} accessibilityRole="button" accessibilityLabel={`Open ${PANELS[key].title}`} onPress={() => show(key)} scaleTo={.95} style={styles.shortcut}>
                <View style={[styles.shortcutIcon, { borderColor: c.walletDisabled }]}>
                  <Feather name={PANELS[key].icon} size={23} color={c.walletInk} />
                </View>
                <Text style={[styles.shortcutLabel, { color: c.walletInk }]}>{PANELS[key].title}</Text>
              </ScalePressable>
            ))}
          </View>
        </View>
        <View testID="dashboard-mining-overview" style={styles.miningSection}>
          <Text style={[styles.sectionTitle, { color: c.walletInk }]}>Mining Overview</Text>
          <View style={styles.miningRow}>
            <View style={styles.miningBar}>
              <RefillMeter
                testID="dashboard-mining-progress"
                orientation="horizontal"
                progress={ready ? snapshot.progress : null}
              />
            </View>
            <Pressable
              testID="dashboard-open-mining"
              accessibilityRole="button"
              accessibilityLabel="Open Mining"
              onPress={() => router.navigate('/search')}
              hitSlop={10}
              style={({ pressed }) => [styles.miningArrow, pressed && { opacity: .5 }]}
            >
              <Feather name="arrow-right" size={23} color={c.walletInk} />
            </Pressable>
          </View>
        </View>
        <RecentActivity />
      </ScrollView>

    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingBottom: 24 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  nameWrap: { flex: 1, minWidth: 0, gap: 2 },
  greeting: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  name: { fontSize: 20, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.4 },
  headerActions: { flexDirection: 'row', gap: 4, flexShrink: 0 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  balanceContent: { alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 24, gap: 6 },
  balanceLabelText: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  amountRow: { minHeight: 62, flexDirection: 'row', alignItems: 'baseline', gap: 8, width: '100%' },
  balance: { fontFamily: 'DMSans_600SemiBold', letterSpacing: -1.5, flexShrink: 1 },
  unit: { fontSize: 18, fontFamily: 'DMSans_500Medium' },
  strike: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  strikeLabel: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  strikeValue: { fontSize: 13, fontFamily: 'DMSans_500Medium', flexShrink: 1 },
  shortcutsSection: { marginTop: 36, gap: 22, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.3 },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: { flex: 1, alignItems: 'center', gap: 12 },
  shortcutIcon: { width: 60, height: 60, borderRadius: 22, borderWidth: 1, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontSize: 12, fontFamily: 'DMSans_500Medium' },
  miningSection: { marginTop: 36, gap: 16, paddingHorizontal: 20 },
  miningRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  miningBar: { flex: 9, minWidth: 0 },
  miningArrow: { flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' },
  note: { fontSize: 12, lineHeight: 18, fontFamily: 'DMSans_400Regular' },
  error: { marginTop: 12, gap: 8, paddingHorizontal: 20 },
  retry: { alignSelf: 'center', padding: 12 },
  statistics: { paddingHorizontal: 12, paddingBottom: 24 },
  preview: { alignItems: 'center', gap: 16, paddingVertical: 28, paddingHorizontal: 12 },
  previewIcon: { height: 64, width: 64, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  previewHeading: { fontSize: 20, fontFamily: 'DMSans_600SemiBold', textAlign: 'center' },
  previewBody: { fontSize: 14, lineHeight: 22, fontFamily: 'DMSans_400Regular', textAlign: 'center', maxWidth: 300 },
});
