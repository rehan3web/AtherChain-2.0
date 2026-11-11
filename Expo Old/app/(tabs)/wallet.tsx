import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import Header from "@/components/Header";
import { walletApi, transactionApi, extractError } from "@/services/api";
import Skeleton from "@/components/Skeleton";
import { useWalletMode } from "@/contexts/WalletModeContext";
import { Web3WalletView } from "@/components/wallet/Web3WalletView";

type WalletStats = {
  at_balance: string;
  ath_balance: string;
  wath_balance: string;
  wallet_address: string;
  kyc_status: string;
  is_transfer_enabled: boolean;
};

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

function TxRow({ item, colors }: { item: Transaction; colors: ReturnType<typeof useColors> }) {
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
      onPress={() => router.push({ pathname: "/receipt", params: { id: item.id, amount: displayAmount, toAddress: item.toAddress || "", fromAddress: item.fromAddress || "", type: item.type, date: item.timestamp ? new Date(item.timestamp).toLocaleDateString() : "", timestamp: item.timestamp || "", status: item.status ?? "completed", hash: item.txHash } })}
      style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      <View style={[styles.txIcon, { backgroundColor: isPos ? colors.primaryPale : colors.destructive + "22" }]}>
        <Feather name={icon as any} size={16} color={isPos ? colors.positive : colors.negative} />
      </View>
      <View style={styles.txBody}>
        <Text style={[styles.txName, { color: colors.foreground }]} numberOfLines={1}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
        <Text style={[styles.txSub, { color: colors.mutedForeground }]} numberOfLines={1}>{item.txHash ? `${item.txHash.slice(0, 12)}...` : item.type}</Text>
      </View>
      <View style={styles.txEnd}>
        <Text style={[styles.txAmount, { color: isPos ? colors.positive : colors.negative }]}>{displayAmount}</Text>
        <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{item.timestamp ? new Date(item.timestamp).toLocaleDateString() : ""}</Text>
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

export default function WalletScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 60 : insets.top;

  const { mode, setMode } = useWalletMode();

  const [activeTab, setActiveTab] = useState<"assets" | "transactions">("assets");
  const [refreshing, setRefreshing] = useState(false);

  const cardGradient: readonly [string, string, string] = ["#163300", "#0e1a08", "#1a2e10"];

  const { data: walletStats = null, isLoading: isStatsLoading, refetch: refetchStats } = useQuery<WalletStats | null>({
    queryKey: ["walletStats"],
    queryFn: walletApi.stats,
    staleTime: 30000,
  });

  const { data: txData, isLoading: isTxLoading, refetch: refetchTx } = useQuery({
    queryKey: ["recentTransactions", 10],
    queryFn: () => transactionApi.list(1, 10),
    staleTime: 30000,
  });

  const loading = isStatsLoading || isTxLoading;
  const txList: Transaction[] = Array.isArray(txData) ? txData : (txData?.data ?? txData?.transactions ?? []);
  const transactions = txList;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStats(), refetchTx()]);
    setRefreshing(false);
  };

  const athBalance = walletStats?.ath_balance ?? "0.0000";
  const atBalance = walletStats?.at_balance ?? "0.0000";
  const [balanceFull, balanceDec] = String(parseFloat(athBalance).toFixed(4)).split(".");

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.content, { paddingTop: topPad + 12, flex: 1 }]}>
        <Header />

        {mode === "web3" ? (
          <Web3WalletView />
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{ paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          >
            {/* Top Header Row: Left = Switch Wallet Mode, Right = Network Pill */}
            <View style={styles.topHeaderRow}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setMode("web3");
                }}
                style={[styles.switchWalletBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="repeat" size={14} color={colors.primary} />
                <View style={[styles.modeMiniIcon, { backgroundColor: colors.primaryPale }]}>
                  <Feather name="zap" size={13} color={colors.primary} />
                </View>
              </Pressable>

              <View style={[styles.networkPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.netDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.netName, { color: colors.foreground }]}>AtherChain</Text>
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
                <View style={styles.cardStatsRow}>
                  <View style={styles.cardStatCol}>
                    <Text style={styles.secLabel}>AT Balance</Text>
                    {loading ? (
                      <Skeleton width={70} height={16} borderRadius={4} style={{ marginTop: 4 }} />
                    ) : (
                      <Text style={styles.secVal}>{`${parseFloat(atBalance).toFixed(4)} AT`}</Text>
                    )}
                  </View>
                  <View style={styles.vertDivider} />
                  <View style={styles.cardStatCol}>
                    <Text style={styles.secLabel}>Network</Text>
                    <Text style={styles.secVal}>Mainnet</Text>
                  </View>
                  <View style={styles.vertDivider} />
                  <View style={styles.cardStatCol}>
                    <Text style={styles.secLabel}>KYC</Text>
                    <Text style={[styles.secVal, { color: walletStats?.kyc_status === "approved" ? colors.positive : colors.mutedForeground, textTransform: "capitalize" }]}>
                      {loading ? "..." : (walletStats?.kyc_status ?? "pending")}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardGlowCircle} />
              </LinearGradient>
            </View>

            <View style={styles.mainActionsRow}>
              <Pressable onPress={() => router.push("/send")} style={[styles.mainBtn, { backgroundColor: colors.primary }]}>
                <Feather name="arrow-up-right" size={18} color={colors.primaryForeground} />
                <Text style={[styles.mainBtnText, { color: colors.primaryForeground }]}>Send</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/receive")} style={[styles.mainBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                <Feather name="arrow-down-left" size={18} color={colors.foreground} />
                <Text style={[styles.mainBtnText, { color: colors.foreground }]}>Receive</Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(tabs)/swap")} style={[styles.mainBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                <Feather name="repeat" size={18} color={colors.foreground} />
                <Text style={[styles.mainBtnText, { color: colors.foreground }]}>Swap</Text>
              </Pressable>
            </View>

            <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Pressable style={[styles.tabButton, activeTab === "assets" && { backgroundColor: colors.background, elevation: 2 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab("assets"); }}>
                <Text style={[styles.tabButtonText, { color: activeTab === "assets" ? colors.foreground : colors.mutedForeground }]}>Assets</Text>
              </Pressable>
              <Pressable style={[styles.tabButton, activeTab === "transactions" && { backgroundColor: colors.background, elevation: 2 }]} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setActiveTab("transactions"); }}>
                <Text style={[styles.tabButtonText, { color: activeTab === "transactions" ? colors.foreground : colors.mutedForeground }]}>Transactions</Text>
              </Pressable>
            </View>

            {activeTab === "assets" ? (
              <View style={styles.section}>
                <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.txIcon, { backgroundColor: colors.primaryPale, overflow: "hidden" }]}>
                    <Image source={require("../../assets/images/link.png")} style={{ width: 24, height: 24 }} resizeMode="contain" />
                  </View>
                  <View style={styles.txBody}>
                    <Text style={[styles.txName, { color: colors.foreground }]}>ATH</Text>
                    <Text style={[styles.txSub, { color: colors.mutedForeground }]}>Native Token</Text>
                  </View>
                  <View style={styles.txEnd}>
                    {loading ? (
                      <Skeleton width={80} height={18} borderRadius={4} style={{ marginBottom: 4 }} />
                    ) : (
                      <Text style={[styles.txAmount, { color: colors.foreground }]}>{parseFloat(athBalance).toFixed(4)}</Text>
                    )}
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>Mainnet Portfolio</Text>
                  </View>
                </View>

                <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.txIcon, { backgroundColor: colors.primaryPale, overflow: "hidden" }]}>
                    <Image source={require("../../assets/images/AT.png")} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  </View>
                  <View style={styles.txBody}>
                    <Text style={[styles.txName, { color: colors.foreground }]}>AT</Text>
                    <Text style={[styles.txSub, { color: colors.mutedForeground }]}>Reward Token</Text>
                  </View>
                  <View style={styles.txEnd}>
                    {loading ? (
                      <Skeleton width={80} height={18} borderRadius={4} style={{ marginBottom: 4 }} />
                    ) : (
                      <Text style={[styles.txAmount, { color: colors.foreground }]}>{parseFloat(atBalance).toFixed(4)}</Text>
                    )}
                    <Text style={[styles.txDate, { color: colors.mutedForeground }]}>Mining Rewards</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.section}>
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
                  <>
                    {transactions.map((item, i) => <TxRow key={item.id ?? i} item={item} colors={colors} />)}
                    <Pressable onPress={() => router.push("/transactions")} style={[styles.historyBtn, { borderColor: colors.border }]}>
                      <Text style={[styles.historyBtnText, { color: colors.mutedForeground }]}>View Full History</Text>
                      <Feather name="arrow-right" size={14} color={colors.mutedForeground} />
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  topHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  switchWalletBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, height: 38, borderRadius: 19, borderWidth: 1 },
  modeMiniIcon: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  networkPill: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, height: 38, borderRadius: 19, borderWidth: 1 },
  netDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#9fe870" },
  netName: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cardWrap: { marginBottom: 24, backgroundColor: "transparent", shadowColor: "#9fe870", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 0 },
  balanceCard: { borderRadius: 24, borderWidth: 1, padding: 24, overflow: "hidden" },
  cardShine: { position: "absolute", top: 0, left: 0, right: 0, height: 80, backgroundColor: "rgba(159,232,112,0.07)", borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  cardGlowCircle: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "rgba(159,232,112,0.05)", right: -60, bottom: -60 },
  cardLabel: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(244,244,240,0.6)", letterSpacing: 0.5, marginBottom: 8 },
  balanceRow: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  balanceBig: { fontSize: 46, fontFamily: "Inter_700Bold", fontWeight: "700", color: "#f4f4f0", letterSpacing: -1.5, lineHeight: 52 },
  balanceCent: { fontSize: 24, fontFamily: "Inter_400Regular", color: "rgba(244,244,240,0.55)", paddingBottom: 4 },
  balanceTicker: { fontSize: 16, fontFamily: "Inter_600SemiBold", letterSpacing: 3, marginTop: 4, marginBottom: 18 },
  cardDivider: { height: 1, backgroundColor: "rgba(159,232,112,0.12)", marginBottom: 14 },
  cardStatsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardStatCol: { flex: 1, alignItems: "center" },
  vertDivider: { width: 1, height: 28, backgroundColor: "rgba(159,232,112,0.15)" },
  secLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(244,244,240,0.45)", marginBottom: 2 },
  secVal: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "rgba(244,244,240,0.85)" },
  mainActionsRow: { flexDirection: "row", gap: 10, marginBottom: 28 },
  mainBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 24 },
  mainBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  tabContainer: { flexDirection: "row", padding: 4, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12 },
  tabButtonText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  section: { marginBottom: 24 },
  txCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 20, borderWidth: 1, marginBottom: 8, gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  txBody: { flex: 1, gap: 3 },
  txName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  txSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  txEnd: { alignItems: "flex-end", gap: 3 },
  txAmount: { fontSize: 14, fontFamily: "Inter_700Bold" },
  txDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  historyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, marginTop: 8, borderRadius: 16, borderWidth: 1, borderStyle: "dashed" },
  historyBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyBox: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
