import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { router } from 'expo-router';
import { useRecentActivities, type Activity } from '@/components/activity/store';

const date = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});

function ActivityRows({ items }: { items: readonly Activity[] }) {
  const c = useColors();
  return <View>
    {items.map((item, index) => (
      <View key={item.id} testID={`dashboard-activity-${item.id}`} style={[
        styles.row,
        index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.walletDisabled },
      ]}>
        <View style={styles.icon}>
          <Feather name={item.icon} size={20} color={c.walletInk} />
        </View>
        <View style={styles.description}>
          <Text numberOfLines={1} style={[styles.title, { color: c.walletInk }]}>{item.title}</Text>
          <Text style={[styles.time, { color: c.walletSubtle }]}>
            {date.format(item.timestamp)}{item.preview ? ' · Preview' : ''}
          </Text>
        </View>
        <Text numberOfLines={1} style={[styles.value, { color: item.positive ? c.walletPositive : c.walletInk }]}>{item.value}</Text>
      </View>
    ))}
  </View>;
}

export function RecentActivity() {
  const c = useColors();
  const activities = useRecentActivities();
  return (
    <View testID="dashboard-recent-activity" style={styles.section}>
      <View style={styles.heading}>
        <Text accessibilityRole="header" style={[styles.headingText, { color: c.walletInk }]}>Recent Activity</Text>
        <Pressable
          testID="dashboard-view-all-activity"
          accessibilityRole="button"
          accessibilityLabel="View all recent activity"
          onPress={() => router.push('/transactions')}
          style={({ pressed }) => [styles.viewAll, { opacity: pressed ? .5 : 1 }]}
        >
          <Text style={[styles.link, { color: c.walletSubtle }]}>View all</Text>
          <Feather name="arrow-up-right" size={15} color={c.walletSubtle} />
        </Pressable>
      </View>
      <ActivityRows items={activities.slice(0, 3)} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 30, paddingHorizontal: 20 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headingText: { fontSize: 18, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.3 },
  viewAll: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  link: { fontSize: 12, fontFamily: 'DMSans_500Medium' },
  row: { minHeight: 78, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 34, alignItems: 'center', justifyContent: 'center' },
  description: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  time: { fontSize: 11, fontFamily: 'DMSans_400Regular' },
  value: { maxWidth: '42%', fontSize: 13, fontFamily: 'DMSans_500Medium', flexShrink: 1 },
});
