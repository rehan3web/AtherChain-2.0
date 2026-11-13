import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ConfirmedIcon } from '@/components/wallet/ConfirmedIcon';
import { monthWeeks } from './model';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function ClaimCalendar({ month, onMonthChange, claimDays, now }: {
  month: Date; onMonthChange: (date: Date) => void; claimDays: readonly string[]; now: number;
}) {
  const c = useColors();
  const weeks = monthWeeks(month.getFullYear(), month.getMonth(), claimDays, now);
  const change = (offset: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + offset, 1, 12));
  return <View testID="statistics-calendar">
    <View style={s.monthRow}>
      <Pressable testID="statistics-prev-month" accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => change(-1)} style={s.nav}><Feather name="chevron-left" size={22} color={c.walletInk} /></Pressable>
      <Text testID="statistics-month" accessibilityRole="header" accessibilityLiveRegion="polite" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.month, { color: c.walletInk }]}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
      <Pressable testID="statistics-next-month" accessibilityRole="button" accessibilityLabel="Next month" onPress={() => change(1)} style={s.nav}><Feather name="chevron-right" size={22} color={c.walletInk} /></Pressable>
    </View>
    <View style={s.grid}>
      <View testID="statistics-weekdays" style={s.row}>
        {WEEKDAYS.map(day => <Text key={day} testID={`statistics-weekday-${day}`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.cell, s.weekday, { color: c.walletSubtle }]}>{day}</Text>)}
      </View>
      {weeks.map((week, index) => <View key={`week-${index}`} testID={`statistics-week-${index}`} style={s.row}>
        {week.map((day, column) => <View key={day?.key ?? `blank-${column}`} testID={`statistics-cell-${index}-${column}`} style={s.cell}>
          {day ? <View testID={`statistics-day-${day.key}`} accessible accessibilityLabel={`${day.key}${day.today ? ', today' : ''}, ${day.claimed ? 'Mining claimed' : 'Not claimed'}`} style={[s.day, { backgroundColor: c.walletField, borderColor: day.claimed ? c.walletPositive : day.today ? c.walletInk : c.walletDisabled }]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.number, { color: day.claimed ? c.walletPositive : c.walletInk }]}>{day.day}</Text>
            {day.claimed ? <View testID={`statistics-claimed-${day.key}`}><ConfirmedIcon size={14} /></View> : <View style={{ height: 14 }} />}
          </View> : <View style={s.empty} />}
        </View>)}
      </View>)}
    </View>
  </View>;
}

const s = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  month: { flex: 1, minWidth: 0, textAlign: 'center', fontFamily: 'DMSans_600SemiBold', fontSize: 18 },
  grid: { gap: 6 },
  row: { flexDirection: 'row', gap: 6 },
  cell: { flex: 1, minWidth: 0 },
  empty: { height: 54 },
  weekday: { fontFamily: 'DMSans_400Regular', fontSize: 11, textAlign: 'center', paddingBottom: 8 },
  day: { height: 54, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  number: { maxWidth: '100%', fontFamily: 'DMSans_500Medium', fontSize: 14 },
});
