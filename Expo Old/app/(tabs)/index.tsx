import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import Header from "@/components/Header";
import { userApi, transactionApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import Skeleton from "@/components/Skeleton";

const QUICK_ACTIONS = [
  { id: "node", label: "Node", icon: "server" },
  { id: "wallet", label: "Wallet", icon: "credit-card" },
  { id: "statics", label: "Statics", icon: "bar-chart-2" },
  { id: "settings", label: "Settings", icon: "settings" },
  { id: "verify", label: "Verify", icon: "shield" },
  { id: "transactions", label: "History", icon: "list" },
  { id: "news", label: "News", icon: "rss" },
  { id: "help", label: "Help", icon: "help-circle" },
] as const;

function ActionButton({ item, colors }: { item: (typeof QUICK_ACTIONS)[number]; colors: ReturnType<typeof useColors> }) {
  const router = useRouter();
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
    if (item.id === "transactions") router.push("/transactions");
    else if (item.id === "wallet") router.push("/(tabs)/wallet");
    else if (item.id === "node") router.push("/(tabs)/node");
    else if (item.id === "statics") router.push("/statics" as any);
    else if (item.id === "settings") router.push("/(tabs)/settings");
    else if (item.id === "verify") router.push("/kyc");
    else if (item.id === "help") router.push("/help");
    else if (item.id === "news") router.push("/news" as any);
  };
  return (
    <Pressable onPress={press} style={styles.actionWrapper}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <View style={[styles.actionCircle, { backgroundColor: colors.primaryPale, borderColor: colors.border }]}>
          <Feather name={item.icon} size={20} color={colors.foreground} />
        </View>
      </Animated.View>
      <Text style={[styles.actionLabel, { color: colors.foreground }]} numberOfLines={1}>{item.label}</Text>
    </Pressable>
  );
}

function TxRow({ item, colors }: { item: any; colors: ReturnType<typeof useColors> }) {
  const router = useRouter();
  const isPos = item.type === "receive" || item.type === "mining" || item.type === "referral";
  const iconMap: Record<string, string> = { swap: "repeat", send: "arrow-up-right", receive: "arrow-down-left", mining: "server", referral: "users" };
  const icon = iconMap[item.type] || "activity";
  const amt = parseFloat(item.amount ?? "0");
  let displayAmount = `${isPos ? "+" : "-"}${Math.abs(amt).toFixed(4)} ATH`;
  if (item.type === "swap") {
    displayAmount = `-${Math.abs(amt).toFixed(4)} AT`;
  }
  const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "";
  const label = item.type ? item.type.charAt(0).toUpperCase() + item.type.slice(1) : "Transaction";
  const sub = item.txHash ? `${item.txHash.slice(0, 16)}...` : item.type;

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
            date: dateStr,
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
        <Text style={[styles.txName, { color: colors.foreground }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.txSub, { color: colors.mutedForeground }]} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={styles.txEnd}>
        <Text style={[styles.txAmount, { color: isPos ? colors.positive : colors.negative }]}>{displayAmount}</Text>
        <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{dateStr}</Text>
      </View>
    </Pressable>
  );
}

function TxRowSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Skeleton width={40} height={40} borderRadius={20} />
      <View style={styles.txBody}>
        <Skeleton width={90} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
        <Skeleton width={140} height={12} borderRadius={4} />
      </View>
      <View style={[styles.txEnd, { justifyContent: "center" }]}>
        <Skeleton width={70} height={16} borderRadius={4} style={{ marginBottom: 6 }} />
        <Skeleton width={50} height={11} borderRadius={3} />
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 60 : insets.top;

  const [refreshing, setRefreshing] = useState(false);

  const { data: dashData, isLoading: isDashLoading, refetch: refetchDash } = useQuery({
    queryKey: ["dashboardStats"],
    queryFn: userApi.dashboardStats,
    staleTime: 30000,
  });

  const { data: txData, isLoading: isTxLoading, refetch: refetchTx } = useQuery({
    queryKey: ["recentTransactions"],
    queryFn: () => transactionApi.list(1, 5),
    staleTime: 30000,
  });

  const loading = isDashLoading || isTxLoading;

  const txList: any[] = Array.isArray(txData) ? txData : (txData?.data ?? txData?.transactions ?? []);
  const transactions: any[] = txList.slice(0, 5);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchDash(), refetchTx()]);
    setRefreshing(false);
  };

  const athBalance = dashData?.user?.balanceATH ?? dashData?.user?.balance_ath ?? "0.0000";
  const atBalance = dashData?.user?.balance_at ?? dashData?.user?.balanceAT ?? "0.0000";
  const [balanceFull, balanceDec] = String(athBalance).split(".");
  const cardGradient: readonly [string, string, string] = ["#163300", "#0e1a08", "#1a2e10"];

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Header />

        <View style={styles.greetRow}>
          <Text style={[styles.greetSub, { color: colors.mutedForeground }]}>{getGreeting()}{user?.firstName ? `, ${user.firstName}` : ""}</Text>
          <View style={[styles.changePill, { backgroundColor: colors.primaryPale }]}>
            <Feather name="activity" size={12} color={colors.foreground} />
            <Text style={[styles.changePillText, { color: colors.foreground }]}>Live</Text>
          </View>
        </View>

        <View style={styles.cardWrap}>
          <LinearGradient colors={cardGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.balanceCard, { borderColor: colors.primaryNeutral }]}>
            <View style={styles.cardShine} />
            <Text style={styles.cardLabel}>Total Balance</Text>
            {loading ? (
              <View style={{ marginVertical: 12 }}>
                <Skeleton width={180} height={46} borderRadius={8} style={{ marginBottom: 12 }} />
                <Skeleton width={50} height={18} borderRadius={4} />
              </View>
            ) : (
              <>
                <View style={styles.balanceRow}>
                  <Text style={styles.balanceBig}>{balanceFull}</Text>
                  <Text style={styles.balanceCent}>.{balanceDec ?? "0000"}</Text>
                </View>
                <Text style={[styles.balanceTicker, { color: colors.primary }]}>ATH</Text>
              </>
            )}
            <View style={styles.cardDivider} />
            <View style={styles.cardFooter}>
              <View>
                <Text style={styles.secLabel}>AT Balance</Text>
                {loading ? (
                  <Skeleton width={70} height={16} borderRadius={4} style={{ marginTop: 4 }} />
                ) : (
                  <Text style={styles.secVal}>{`${atBalance} AT`}</Text>
                )}
              </View>
              <View style={[styles.livePill, { backgroundColor: "rgba(159,232,112,0.15)", borderColor: "rgba(159,232,112,0.25)" }]}>
                <View style={[styles.liveDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.liveText, { color: colors.primary }]}>Live</Text>
              </View>
            </View>
            <View style={styles.cardGlowCircle} />
          </LinearGradient>
        </View>

        <View style={styles.mainActionsRow}>
          <Pressable onPress={() => router.push("/send" as any)} style={[styles.mainBtn, { backgroundColor: colors.primary }]}>
            <Feather name="arrow-up-right" size={18} color={colors.primaryForeground} />
            <Text style={[styles.mainBtnText, { color: colors.primaryForeground }]}>Send</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/receive" as any)} style={[styles.mainBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
            <Feather name="arrow-down-left" size={18} color={colors.foreground} />
            <Text style={[styles.mainBtnText, { color: colors.foreground }]}>Receive</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/(tabs)/swap")} style={[styles.mainBtnSq, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
            <Feather name="repeat" size={20} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
          <View style={[styles.actionsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.actionsGrid}>
              {QUICK_ACTIONS.map((item) => <ActionButton key={item.id} item={item} colors={colors} />)}
            </View>
          </View>
        </View>

        <View style={[styles.section, { paddingBottom: 24 }]}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent Transactions</Text>
            <Pressable onPress={() => router.push("/transactions")} style={[styles.seeAllPill, { backgroundColor: colors.primaryPale }]}>
              <Text style={[styles.seeAllText, { color: colors.foreground }]}>See all</Text>
            </Pressable>
          </View>
          {loading ? (
            <View style={{ gap: 8 }}>
              {[1, 2, 3, 4, 5].map((key) => <TxRowSkeleton key={key} />)}
            </View>
          ) : transactions.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="inbox" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No transactions yet</Text>
            </View>
          ) : (
            transactions.map((item, i) => <TxRow key={item._id ?? item.id ?? i} item={item} colors={colors} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  greetRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  greetSub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  changePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  changePillText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  cardWrap: { marginBottom: 16, backgroundColor: "transparent", shadowColor: "#9fe870", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 0 },
  balanceCard: { borderRadius: 24, borderWidth: 1, padding: 24, overflow: "hidden", minHeight: 190 },
  cardShine: { position: "absolute", top: 0, left: 0, right: 0, height: 80, backgroundColor: "rgba(159,232,112,0.07)", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  cardGlowCircle: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(159,232,112,0.05)", right: -60, bottom: -60 },
  cardLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(244,244,240,0.6)", letterSpacing: 0.5, marginBottom: 6 },
  balanceRow: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  balanceBig: { fontSize: 46, fontFamily: "Inter_700Bold", fontWeight: "700", color: "#f4f4f0", letterSpacing: -1.5, lineHeight: 52 },
  balanceCent: { fontSize: 24, fontFamily: "Inter_400Regular", color: "rgba(244,244,240,0.55)", paddingBottom: 4 },
  balanceTicker: { fontSize: 14, fontFamily: "Inter_600SemiBold", letterSpacing: 3, marginTop: 2, marginBottom: 18 },
  cardDivider: { height: 1, backgroundColor: "rgba(159,232,112,0.12)", marginBottom: 14 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  secLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(244,244,240,0.45)", marginBottom: 2 },
  secVal: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "rgba(244,244,240,0.85)" },
  livePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999, borderWidth: 1 },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  liveText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  mainActionsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  mainBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 24 },
  mainBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  mainBtnSq: { width: 52, alignItems: "center", justifyContent: "center", borderRadius: 24 },
  section: { marginBottom: 24 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", fontWeight: "700", marginBottom: 12 },
  seeAllPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999, marginBottom: 12 },
  seeAllText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  actionsCard: { borderRadius: 24, borderWidth: 1, padding: 16 },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
  actionWrapper: { width: "25%", alignItems: "center", gap: 7 },
  actionCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  txCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 20, borderWidth: 1, marginBottom: 8, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txBody: { flex: 1, gap: 3 },
  txName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  txSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  txEnd: { alignItems: "flex-end", gap: 3 },
  txAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyBox: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
