import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { referralApi } from "@/services/api";
import Skeleton from "@/components/Skeleton";

type ReferralEntry = {
  username: string;
  kyc_status: string;
  join_date: string;
  activity_status: string;
  mining_progress: string;
};

type ReferralData = {
  referralCode: string;
  referralLink: string;
  totalReferrals: number;
  totalEarned: number;
  referrals: ReferralEntry[];
  config: {
    unverifiedReward: number;
    verifiedReward: number;
  };
};

function HistoryCardSkeleton() {
  const colors = useColors();
  return (
    <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.histHeader}>
        <View style={styles.histIdent}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width={80} height={16} borderRadius={4} />
        </View>
        <Skeleton width={60} height={12} borderRadius={3} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.histGrid}>
        <View style={styles.histCol}>
          <Skeleton width={45} height={12} borderRadius={3} style={{ marginBottom: 4 }} />
          <Skeleton width={50} height={14} borderRadius={3} />
        </View>
        <View style={styles.histCol}>
          <Skeleton width={45} height={12} borderRadius={3} style={{ marginBottom: 4 }} />
          <Skeleton width={60} height={14} borderRadius={3} />
        </View>
        <View style={styles.histCol}>
          <Skeleton width={60} height={12} borderRadius={3} style={{ marginBottom: 4 }} />
          <Skeleton width={50} height={14} borderRadius={3} />
        </View>
      </View>
    </View>
  );
}

export default function ReferralScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 60 : insets.top;

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const result = await referralApi.stats();
      setData(result);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleInvite = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const link = data?.referralLink ?? `https://ather.network/register?ref=${data?.referralCode ?? ""}`;
      await Share.share({
        message: `Join Ather Network and start mining! Use my invite link: ${link}`,
      });
    } catch {}
  };

  const activeCount = data?.referrals.filter(r => r.activity_status === "Active").length ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Header />

        <View style={styles.titleArea}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Referrals</Text>
          <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Invite friends and earn rewards</Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {loading ? (
              <Skeleton width={50} height={22} borderRadius={4} />
            ) : (
              <Text style={[styles.statValue, { color: colors.foreground }]}>{data?.totalReferrals ?? 0}</Text>
            )}
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total Referrals</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {loading ? (
              <Skeleton width={40} height={22} borderRadius={4} />
            ) : (
              <Text style={[styles.statValue, { color: colors.foreground }]}>{activeCount}</Text>
            )}
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Active Referrals</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {loading ? (
              <Skeleton width={80} height={22} borderRadius={4} />
            ) : (
              <Text style={[styles.statValue, { color: colors.primary }]}>{(data?.totalEarned ?? 0).toFixed(2)} AT</Text>
            )}
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Total Rewards</Text>
          </View>
        </View>

        <View style={[styles.codeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.codeLabel, { color: colors.mutedForeground }]}>Your Referral Code</Text>
          {loading ? (
            <Skeleton width={120} height={28} borderRadius={6} />
          ) : (
            <Text style={[styles.codeValue, { color: colors.primary }]}>{data?.referralCode ?? "—"}</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Reward Tiers</Text>

          <View style={[styles.tierCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.tierTop}>
              <Text style={[styles.tierName, { color: colors.foreground }]}>Registration Reward</Text>
              <View style={[styles.statusBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statusText, { color: colors.foreground }]}>ACTIVE</Text>
              </View>
            </View>
            {loading ? (
              <Skeleton width={120} height={14} borderRadius={3} style={{ marginVertical: 3 }} />
            ) : (
              <Text style={[styles.tierReward, { color: colors.primary }]}>
                {data?.config.unverifiedReward ?? 0.1} AT / INSTANT
              </Text>
            )}
          </View>

          <View style={[styles.tierCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.tierTop}>
              <Text style={[styles.tierName, { color: colors.foreground }]}>KYC Verification</Text>
              <View style={[styles.statusBadge, { backgroundColor: colors.primaryPale, borderColor: colors.primaryNeutral }]}>
                <Text style={[styles.statusText, { color: colors.primary }]}>BOOSTED</Text>
              </View>
            </View>
            {loading ? (
              <Skeleton width={120} height={14} borderRadius={3} style={{ marginVertical: 3 }} />
            ) : (
              <Text style={[styles.tierReward, { color: colors.primary }]}>
                {data?.config.verifiedReward ?? 1} AT / UNLOCKED
              </Text>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>History</Text>

          {loading ? (
            <View style={{ gap: 12 }}>
              {[1, 2, 3].map((key) => <HistoryCardSkeleton key={key} />)}
            </View>
          ) : (data?.referrals ?? []).length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="users" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No referrals yet</Text>
            </View>
          ) : (
            (data?.referrals ?? []).map((item, i) => (
              <View key={i} style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.histHeader}>
                  <View style={styles.histIdent}>
                    <View style={[styles.identIcon, { backgroundColor: colors.primaryPale }]}>
                      <Feather name="user" size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.histName, { color: colors.foreground }]}>{item.username}</Text>
                  </View>
                  <Text style={[styles.histDate, { color: colors.mutedForeground }]}>
                    {item.join_date ? new Date(item.join_date).toLocaleDateString() : "—"}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.histGrid}>
                  <View style={styles.histCol}>
                    <Text style={[styles.histLabel, { color: colors.mutedForeground }]}>Activity</Text>
                    <Text style={[styles.histVal, { color: item.activity_status === "Active" ? colors.positive : colors.negative }]}>
                      {item.activity_status?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.histCol}>
                    <Text style={[styles.histLabel, { color: colors.mutedForeground }]}>Progress</Text>
                    <Text style={[styles.histVal, { color: colors.foreground }]}>{item.mining_progress}</Text>
                  </View>
                  <View style={styles.histCol}>
                    <Text style={[styles.histLabel, { color: colors.mutedForeground }]}>Verification</Text>
                    <Text style={[styles.histVal, { color: colors.foreground, textTransform: "capitalize" }]}>{item.kyc_status ?? "unverified"}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.fixedBottom, { paddingBottom: insets.bottom || 24 }]}>
        <LinearGradient colors={["transparent", colors.background]} style={styles.fadeBg} pointerEvents="none" />
        <Pressable style={[styles.mainBtn, { backgroundColor: colors.primary }]} onPress={handleInvite}>
          <Feather name="share" size={18} color={colors.primaryForeground} />
          <Text style={[styles.mainBtnText, { color: colors.primaryForeground }]}>Invite Now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  titleArea: { marginBottom: 24 },
  pageTitle: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 6 },
  pageSub: { fontSize: 14, fontFamily: "Inter_400Regular" },
  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statBox: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 6 },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  codeCard: { padding: 16, borderRadius: 16, borderWidth: 1, alignItems: "center", marginBottom: 28 },
  codeLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
  codeValue: { fontSize: 22, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 16 },
  tierCard: { padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  tierTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  tierName: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  statusText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  tierReward: { fontSize: 14, fontFamily: "Inter_700Bold" },
  historyCard: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 16 },
  histHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  histIdent: { flexDirection: "row", alignItems: "center", gap: 8 },
  identIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  histName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  histDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
  divider: { height: 1, marginBottom: 16 },
  histGrid: { flexDirection: "row", justifyContent: "space-between" },
  histCol: { flex: 1 },
  histLabel: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4 },
  histVal: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyBox: { borderRadius: 20, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  fixedBottom: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 40 },
  fadeBg: { position: "absolute", bottom: 0, left: 0, right: 0, top: 0 },
  mainBtn: { flexDirection: "row", gap: 8, paddingVertical: 18, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  mainBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
