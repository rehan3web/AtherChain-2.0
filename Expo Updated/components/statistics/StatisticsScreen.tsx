import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useMining } from '@/components/mining/useMining';
import { useRecentActivities } from '@/components/activity/store';
import { ConfirmedIcon } from '@/components/wallet/ConfirmedIcon';
import { ClaimCalendar } from './ClaimCalendar';
import { activityTotals, miningStreak } from './model';

export function StatisticsScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const mining = useMining();
  const activities = useRecentActivities();
  const [month, setMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1, 12);
  });
  const ready = !mining.loading && !mining.error && !!mining.snapshot;
  const streak = ready ? miningStreak(mining.claimDays, Date.now()) : 0;
  const totals = activityTotals(activities);
  return <View testID="statistics-screen" style={[s.page, { backgroundColor: c.miningPage, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
    <View style={s.header}>
      <Pressable testID="statistics-back" accessibilityRole="button" accessibilityLabel="Back to dashboard" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={s.back}><Feather name="arrow-left" size={24} color={c.walletInk} /></Pressable>
      <Text accessibilityRole="header" style={[s.title, { color: c.walletInk }]}>Statistics</Text>
      {Platform.OS === 'web' && <Pressable testID="statistics-refresh-button" onPress={() => { void mining.refresh(); }}
        disabled={mining.refreshing} accessibilityRole="button" accessibilityLabel="Refresh statistics" style={s.back}>
        {mining.refreshing ? <ActivityIndicator color={c.walletInk} /> : <Feather name="refresh-cw" size={20} color={c.walletInk} />}
      </Pressable>}
    </View>
    <ScrollView testID="statistics-scroll" showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl testID="statistics-refresh" refreshing={mining.refreshing} onRefresh={() => { void mining.refresh(); }} tintColor={c.walletInk} />}
      contentContainerStyle={[s.content, { paddingBottom: Math.max(insets.bottom, 32) }]}>
      {mining.loading ? <View style={s.loading}><ActivityIndicator accessibilityLabel="Loading mining calendar" color={c.walletInk} /></View> : mining.error ? <View style={s.error}>
        <Text testID="statistics-error" accessibilityRole="alert" style={[s.note, { color: c.walletError }]}>{mining.error}</Text>
        <Pressable testID="statistics-retry" accessibilityRole="button" accessibilityLabel="Retry claim history" onPress={mining.retry} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[s.value, { color: c.walletInk }]}>Try again</Text></Pressable>
      </View> : <ClaimCalendar month={month} onMonthChange={setMonth} claimDays={mining.claimDays} now={Date.now()} />}
      <View style={s.metrics}>
        <View style={[s.row, { borderBottomColor: c.walletDisabled }]}>
          <Text style={[s.label, { color: c.walletSubtle }]}>Mining Streak</Text>
          <View style={s.status}>
            {ready && streak > 0 && <ConfirmedIcon />}
            <Text testID="statistics-streak" style={[s.value, { color: ready && streak > 0 ? c.walletPositive : c.walletInk }]}>{ready ? `${streak} ${streak === 1 ? 'Day' : 'Days'}` : '—'}</Text>
          </View>
        </View>
        <View style={[s.row, { borderBottomColor: c.walletDisabled }]}>
          <Text style={[s.label, { color: c.walletSubtle }]}>Total Swap</Text>
          <Text testID="statistics-total-swap" style={[s.value, { color: c.walletInk }]}>{totals.swaps}</Text>
        </View>
        <View style={[s.row, { borderBottomWidth: 0 }]}>
          <Text style={[s.label, { color: c.walletSubtle }]}>Total Transfer</Text>
          <Text testID="statistics-total-transfer" style={[s.value, { color: c.walletInk }]}>{totals.transfers}</Text>
        </View>
      </View>
      <Text style={[s.note, { color: c.walletSubtle }]}>Claim days and account activity are loaded from your AtherChain history.</Text>
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  page: { flex: 1 },
  header: { height: 60, marginHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  back: { position: 'absolute', left: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.4 },
  content: { paddingHorizontal: 24, paddingTop: 20, width: '100%', maxWidth: 560, alignSelf: 'center', gap: 28 },
  loading: { height: 340, alignItems: 'center', justifyContent: 'center' },
  error: { gap: 8, paddingVertical: 24 },
  metrics: { marginTop: 4 },
  row: { minHeight: 68, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 0.5, gap: 12 },
  label: { fontFamily: 'DMSans_400Regular', fontSize: 15, lineHeight: 22 },
  value: { fontFamily: 'DMSans_500Medium', fontSize: 15, lineHeight: 22 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  note: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 18 },
});
