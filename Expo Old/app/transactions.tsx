import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { transactionApi } from "@/services/api";

type Transaction = {
  id: string;
  type: string;
  amount: string;
  status: string;
  txHash: string;
  timestamp: string;
  fromAddress?: string;
  toAddress?: string;
  metadata?: any;
};

function TxRow({ item, colors }: { item: Transaction; colors: any }) {
  const router = useRouter();
  const isPos = item.type === "receive" || item.type === "mining" || item.type === "referral";
  const iconMap: Record<string, string> = { swap: "repeat", send: "arrow-up-right", receive: "arrow-down-left", mining: "server", referral: "users" };
  const icon = iconMap[item.type] || "activity";
  const amt = parseFloat(item.amount);
  let displayAmount = `${isPos ? "+" : "-"}${Math.abs(amt).toFixed(4)} ATH`;
  if (item.type === "swap") {
    displayAmount = `-${Math.abs(amt).toFixed(4)} AT`;
  }

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/receipt",
          params: {
            id: item.id,
            amount: displayAmount,
            toAddress: item.toAddress || "",
            fromAddress: item.fromAddress || "",
            type: item.type,
            date: item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "",
            timestamp: item.timestamp || "",
            status: item.status ?? "completed",
            hash: item.txHash,
          },
        })
      }
      style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.txIcon, { backgroundColor: isPos ? colors.primaryPale : colors.destructive + "22" }]}>
        <Feather name={icon as any} size={16} color={isPos ? colors.positive : colors.negative} />
      </View>
      <View style={styles.txBody}>
        <Text style={[styles.txName, { color: colors.foreground }]}>
          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
        </Text>
        <Text style={[styles.txSub, { color: colors.mutedForeground }]} numberOfLines={1}>
          {item.txHash ? `${item.txHash.slice(0, 16)}...` : item.status}
        </Text>
      </View>
      <View style={styles.txEnd}>
        <Text style={[styles.txAmount, { color: isPos ? colors.positive : colors.negative }]}>{displayAmount}</Text>
        <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
          {item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ""}
        </Text>
      </View>
    </Pressable>
  );
}

export default function TransactionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const loadData = useCallback(async (pageNum = 1, append = false) => {
    try {
      const result = await transactionApi.list(pageNum, 20);
      const txList: Transaction[] = Array.isArray(result) ? result : (result?.data ?? []);
      const meta = result?.meta ?? {};
      setTotalPages(meta.totalPages ?? 1);
      setTotalCount(meta.totalCount ?? txList.length);
      if (append) {
        setTransactions((prev) => [...prev, ...txList]);
      } else {
        setTransactions(txList);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => { loadData(1); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadData(1);
  };

  const loadMore = () => {
    if (loadingMore || page >= totalPages) return;
    const next = page + 1;
    setPage(next);
    setLoadingMore(true);
    loadData(next, true);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
          if (isAtBottom) loadMore();
        }}
        scrollEventThrottle={400}
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Header />

          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>Transactions</Text>
            {!loading && (
              <View style={[styles.badge, { backgroundColor: colors.primaryPale }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>{totalCount}</Text>
              </View>
            )}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : transactions.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions yet</Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Your transaction history will appear here</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {transactions.map((tx, i) => (
                <TxRow key={tx.id ?? i} item={tx} colors={colors} />
              ))}
              {loadingMore && <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />}
              {!loadingMore && page < totalPages && (
                <Pressable onPress={loadMore} style={[styles.loadMoreBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.loadMoreText, { color: colors.mutedForeground }]}>Load More</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={[styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder, paddingBottom: insets.bottom }]}>
        {[
          { id: "index", label: "Home", icon: "home" },
          { id: "node", label: "Node", icon: "cpu" },
          { id: "swap", label: "Swap", icon: "repeat", isCenter: true },
          { id: "wallet", label: "Wallet", icon: "credit-card" },
          { id: "referral", label: "Referral", icon: "users" },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => router.replace(`/(tabs)/${tab.id === "index" ? "" : tab.id}` as any)}
            style={styles.tabItem}
          >
            {tab.isCenter ? (
              <View style={[styles.centerCircle, { backgroundColor: colors.primary }]}>
                <Feather name={tab.icon as any} size={22} color={colors.primaryForeground} />
              </View>
            ) : (
              <Feather name={tab.icon as any} size={20} color={colors.mutedForeground} />
            )}
            <Text style={[styles.tabLabel, { color: colors.mutedForeground }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 20 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  badge: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 12 },
  badgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  list: { gap: 8 },
  txCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 20, borderWidth: 1, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txBody: { flex: 1, gap: 3 },
  txName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  txSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  txEnd: { alignItems: "flex-end", gap: 3 },
  txAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyBox: { borderRadius: 20, borderWidth: 1, padding: 40, alignItems: "center", gap: 8, marginTop: 20 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  loadMoreBtn: { paddingVertical: 14, borderRadius: 16, borderWidth: 1, alignItems: "center", marginTop: 8 },
  loadMoreText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  tabBar: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: "center", gap: 3, paddingBottom: 4 },
  tabLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  centerCircle: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", marginTop: -20, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 8 },
});
