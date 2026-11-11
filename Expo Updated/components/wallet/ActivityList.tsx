import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { fmtDate, formatReceiptAmount, type Money } from './format';
import { TxIcon } from './primitives';
import type { Transaction } from './types';

export function ActivityList({ transactions, money: m, locale, onSelect }: { transactions: Transaction[]; money: Money; locale: string; onSelect: (transaction: Transaction) => void }) {
  const c = useColors();
  if (!transactions.length) {
    return (
      <View style={styles.empty} testID="wallet-activity-empty">
        <Feather name="inbox" size={28} color={c.walletMuted} />
        <Text style={[styles.emptyText, { color: c.walletMuted }]}>No transactions yet</Text>
      </View>
    );
  }
  return (
    <View style={styles.list} testID="wallet-activity-list">
      {transactions.map((t, i) => (
        <Pressable
          key={t.id}
          accessible
          accessibilityRole="button"
          accessibilityHint="Open demo transaction receipt"
          accessibilityLabel={`${t.title}, ${fmtDate(t.date, locale)}, ${t.amount > 0 ? 'received' : 'sent'} ${formatReceiptAmount(m, Math.abs(t.amount))}`}
          testID={`wallet-transaction-${t.id}`}
          onPress={() => onSelect(t)}
          style={({ pressed }) => [
            styles.row,
            i < transactions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.walletDisabled },
            pressed && { backgroundColor: c.walletFieldPressed },
          ]}
        >
          <TxIcon tx={t} size={44} />
          <View style={styles.mid}>
            <Text numberOfLines={1} style={[styles.title, { color: c.walletInk }]}>{t.title}</Text>
            <Text style={[styles.date, { color: c.walletMuted }]}>{fmtDate(t.date, locale)}</Text>
          </View>
          <Text style={[styles.amt, { color: t.amount > 0 ? c.walletPositive : c.walletInk }]}>
            {t.amount > 0 ? '+' : ''}
            {formatReceiptAmount(m, Math.abs(t.amount))}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 40, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 15, fontFamily: 'DMSans_400Regular' },
  list: { paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  mid: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontFamily: 'DMSans_500Medium' },
  date: { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 2 },
  amt: { fontSize: 16, fontFamily: 'DMSans_600SemiBold', fontVariant: ['tabular-nums'] },
});
