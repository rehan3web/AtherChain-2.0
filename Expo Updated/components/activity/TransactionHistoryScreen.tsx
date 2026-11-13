import React, { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { SendReceipt } from '@/components/wallet/SendReceipt';
import { SwapReceipt } from '@/components/wallet/SwapReceipt';
import { useTransactionActivityResource, type Activity, type ActivityReceipt } from './store';
import { receiptMoney } from './receiptMoney';
import { BackendScreenState } from '@/components/BackendScreenState';

type Txn = Activity & { receipt: ActivityReceipt };

const date = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

function Row({ item, onPress }: { item: Txn; onPress: () => void }) {
  const c = useColors();
  const when = date.format(item.timestamp);
  return (
    <Pressable
      testID={`txn-history-row-${item.id}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${item.value}, ${when}`}
      accessibilityHint="Opens the transaction receipt"
      style={({ pressed }) => [styles.row, { opacity: pressed ? .55 : 1 }]}
    >
      <View style={[styles.icon, { backgroundColor: c.walletField }]}>
        <Feather name={item.icon} size={18} color={c.walletInk} />
      </View>
      <View style={styles.description}>
        <Text numberOfLines={1} style={[styles.title, { color: c.walletInk }]}>{item.title}</Text>
        <Text numberOfLines={1} style={[styles.time, { color: c.walletSubtle }]}>
          {when}{item.preview ? ' · Preview' : ''}
        </Text>
      </View>
      <Text numberOfLines={1} style={[styles.value, { color: item.positive ? c.walletPositive : c.walletInk }]}>{item.value}</Text>
      <Feather name="chevron-right" size={18} color={c.walletSubtle} />
    </Pressable>
  );
}

export function TransactionHistoryScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const resource = useTransactionActivityResource();
  const items = resource.items;
  const [selected, setSelected] = useState<Txn | null>(null);
  const back = () => router.canGoBack() ? router.back() : router.replace('/');
  const close = () => setSelected(null);
  const r = selected?.receipt;

  if (resource.loading || resource.error) return <BackendScreenState testID="transactions-loading"
    error={resource.loading ? null : resource.error} onRetry={() => { void resource.reload(); }} onBack={back} />;
  return (
    <View testID="screen-transactions" style={[styles.page, { backgroundColor: c.walletCardTop, paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={back}
          testID="transactions-back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.back, { opacity: pressed ? .5 : 1 }]}
        >
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>
      <FlatList
        testID="transactions-list"
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <Row item={item} onPress={() => setSelected(item)} />}
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: c.walletDisabled }]} />}
        ListEmptyComponent={
          <View testID="transactions-empty" style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: c.walletField }]}>
              <Feather name="clock" size={26} color={c.walletSubtle} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.walletInk }]}>No transactions yet</Text>
            <Text style={[styles.emptyBody, { color: c.walletSubtle }]}>
              Your transfers, swaps and mining claims will show up here.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 24) }, !items.length && styles.listEmpty]}
      />
      {r?.type === 'send' && <SendReceipt receipt={r.data} money={receiptMoney(r.currency)} onClose={close} />}
      {r?.type === 'swap' && <SwapReceipt receipt={r.data} onClose={close} />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 20 },
  listEmpty: { flexGrow: 1 },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 16, paddingBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  note: { fontSize: 12, fontFamily: 'DMSans_400Regular', flexShrink: 1 },
  row: { minHeight: 78, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  description: { flex: 1, minWidth: 0, gap: 6 },
  title: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
  time: { fontSize: 11, fontFamily: 'DMSans_400Regular' },
  value: { maxWidth: '38%', fontSize: 13, fontFamily: 'DMSans_500Medium', flexShrink: 1 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 50 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 64, gap: 10 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 16, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.3 },
  emptyBody: { fontSize: 13, lineHeight: 19, fontFamily: 'DMSans_400Regular', textAlign: 'center', maxWidth: 280 },
});
