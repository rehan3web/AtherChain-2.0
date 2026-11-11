import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Platform,
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
import { miningApi, extractError } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { scheduleMiningReadyNotifications, cancelMiningNotifications } from "@/utils/miningNotifications";
import Skeleton from "@/components/Skeleton";


const { width: SCREEN_W } = Dimensions.get("window");

type MiningStatus = {
  canMine: boolean;
  timeLeft: number;
  dailyReward: number;
  isGloballyActive: boolean;
  userMiningPaused: boolean;
  boostReward: number;
  boostEnabled: boolean;
  maxBoosts: number;
  currentCycleBoosts: number;
  currentYield: number;
};

export default function NodeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 60 : insets.top;
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();

  const [refreshing, setRefreshing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [countdown, setCountdown] = useState(0);


  const { data: status = null, isLoading: loading, refetch } = useQuery<MiningStatus | null>({
    queryKey: ["miningStatus"],
    queryFn: miningApi.status,
    staleTime: 15000,
  });

  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const stoneScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, [floatAnim]);

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulseLoop.start();
    return () => pulseLoop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    if (status) {
      const tl = status.timeLeft > 0 ? status.timeLeft : 0;
      setCountdown(tl);
      scheduleMiningReadyNotifications(tl).catch(() => {});
    }
  }, [status]);

  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          refetch();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown, refetch]);

  const executeClaim = async () => {
    if (!status?.canMine || claiming) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.timing(stoneScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(stoneScale, { toValue: 1.1, duration: 120, useNativeDriver: true }),
      Animated.timing(stoneScale, { toValue: 1.0, duration: 150, useNativeDriver: true }),
    ]).start();

    setClaiming(true);
    try {
      cancelMiningNotifications().catch(() => {});
      const result = await miningApi.start();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`+${result.reward} AT added to your balance.`, "success");
      await refreshUser();
      await refetch();
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast(extractError(err), "error");
    } finally {
      setClaiming(false);
    }
  };

  const executeBoost = async () => {
    if (!status?.boostEnabled || boosting) return;
    const boostsLeft = (status?.maxBoosts ?? 0) - (status?.currentCycleBoosts ?? 0);
    if (boostsLeft <= 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.sequence([
      Animated.timing(stoneScale, { toValue: 1.3, duration: 120, useNativeDriver: true }),
      Animated.timing(stoneScale, { toValue: 0.9, duration: 120, useNativeDriver: true }),
      Animated.timing(stoneScale, { toValue: 1.0, duration: 180, useNativeDriver: true }),
    ]).start();

    setBoosting(true);
    try {
      const result = await miningApi.claimBoost();
      toast(`Boost applied! +${result.boostReward} AT extra on next claim.`, "success");
      await refetch();
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setBoosting(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };



  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const translateY = floatAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] });
  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.15] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });

  const isMining = !status?.canMine && countdown > 0;
  const boostsLeft = (status?.maxBoosts ?? 0) - (status?.currentCycleBoosts ?? 0);
  const atBalance = user?.balance_wath ?? "0.00";

  const gridCards = [
    { id: "total", label: "AT Balance", value: `${parseFloat(String(atBalance)).toFixed(2)} AT`, icon: "server", color: colors.primary },
    { id: "streak", label: "Daily Yield", value: `${status?.dailyReward ?? "1"} AT`, icon: "zap", color: "#ffd11a" },
    { id: "boosts", label: "Boosts Left", value: status ? `${boostsLeft}/${status.maxBoosts}` : "—", icon: "users", color: colors.primary },
    { id: "status", label: "Status", value: isMining ? "Active" : (status?.canMine ? "Ready" : "Idle"), icon: "activity", color: isMining ? colors.primary : colors.mutedForeground, showDot: true },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.neonBgGlow} pointerEvents="none">
        <LinearGradient colors={["rgba(159,232,112,0.18)", "rgba(14,15,12,0)", "rgba(159,232,112,0.04)"]} style={StyleSheet.absoluteFill} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <Header />

        <View style={styles.titleBlock}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Mining Center</Text>
          <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Secure the AtherChain network and earn block rewards</Text>
        </View>

        <View style={styles.centerSection}>
          <View style={styles.orbContainer}>
            <Animated.View style={[styles.pulseRing, { borderColor: isMining ? colors.primary : "rgba(159,232,112,0.3)", shadowColor: colors.primary, opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
            <View style={[styles.neonCircle, { borderColor: colors.primary, backgroundColor: "rgba(14,15,12,0.7)", shadowColor: colors.primary }]}>
              <Animated.View style={{ transform: [{ translateY }, { scale: stoneScale }] }}>
                <Image source={require("@/assets/images/stone.png")} style={styles.stoneImage} contentFit="contain" />
              </Animated.View>
            </View>

            <View style={[styles.cornerPill, styles.topLeft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="credit-card" size={10} color={colors.primary} />
              <View>
                <Text style={[styles.pillLabel, { color: colors.mutedForeground }]}>AT Balance</Text>
                {loading ? (
                  <Skeleton width={50} height={12} borderRadius={3} style={{ marginTop: 2 }} />
                ) : (
                  <Text style={[styles.pillValue, { color: colors.foreground }]}>{parseFloat(String(atBalance)).toFixed(2)} AT</Text>
                )}
              </View>
            </View>

            <View style={[styles.cornerPill, styles.topRight, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="trending-up" size={10} color={colors.primary} />
              <View>
                <Text style={[styles.pillLabel, { color: colors.mutedForeground }]}>Yield</Text>
                {loading ? (
                  <Skeleton width={45} height={12} borderRadius={3} style={{ marginTop: 2 }} />
                ) : (
                  <Text style={[styles.pillValue, { color: colors.foreground }]}>{status?.currentYield?.toFixed(2) ?? "1.00"} AT</Text>
                )}
              </View>
            </View>

            <View style={[styles.cornerPill, styles.bottomLeft, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="zap" size={10} color="#ffd11a" />
              <View>
                <Text style={[styles.pillLabel, { color: colors.mutedForeground }]}>Boosts</Text>
                {loading ? (
                  <Skeleton width={40} height={12} borderRadius={3} style={{ marginTop: 2 }} />
                ) : (
                  <Text style={[styles.pillValue, { color: colors.foreground }]}>{boostsLeft} left</Text>
                )}
              </View>
            </View>

            <View style={[styles.cornerPill, styles.bottomRight, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="award" size={10} color={colors.primary} />
              <View>
                <Text style={[styles.pillLabel, { color: colors.mutedForeground }]}>Cooldown</Text>
                {loading ? (
                  <Skeleton width={45} height={12} borderRadius={3} style={{ marginTop: 2 }} />
                ) : (
                  <Text style={[styles.pillValue, { color: colors.foreground }]}>{isMining ? formatTime(countdown) : "Ready"}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <View style={styles.controlsBlock}>
          {loading ? (
            <Skeleton width="100%" height={54} borderRadius={24} style={{ marginBottom: 4 }} />
          ) : (
            <Pressable
              onPress={executeClaim}
              disabled={!status?.canMine || claiming}
              style={[styles.claimBtn, { backgroundColor: status?.canMine ? colors.primary : colors.card, borderColor: status?.canMine ? "transparent" : colors.primaryNeutral, opacity: claiming ? 0.7 : 1 }]}
            >
              <View style={styles.claimBtnContent}>
                {claiming ? (
                  <ActivityIndicator color={status?.canMine ? colors.primaryForeground : colors.primary} size="small" />
                ) : (
                  <Feather name={status?.canMine ? "arrow-right" : "check-circle"} size={18} color={status?.canMine ? colors.primaryForeground : colors.primary} />
                )}
                <Text style={[styles.claimBtnText, { color: status?.canMine ? colors.primaryForeground : colors.primary }]}>
                  {claiming ? "Claiming..." : status?.canMine ? "Tap to Claim" : `Cooldown: ${formatTime(countdown)}`}
                </Text>
              </View>
            </Pressable>
          )}

          {loading ? (
            <Skeleton width="100%" height={50} borderRadius={24} />
          ) : (
            <Pressable
              onPress={executeBoost}
              disabled={boostsLeft === 0 || !status?.boostEnabled || boosting}
              style={[styles.boostBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: (boostsLeft === 0 || !status?.boostEnabled) ? 0.45 : 1 }]}
            >
              <LinearGradient colors={status?.currentCycleBoosts ? ["rgba(159,232,112,0.12)", "rgba(14,15,12,0)"] : ["transparent", "transparent"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} />
              {boosting ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : (
                <Feather name="zap" size={16} color={status?.currentCycleBoosts ? "#ffd11a" : colors.primary} />
              )}
              <Text style={[styles.boostBtnText, { color: colors.foreground }]}>
                {boosting ? "Applying..." : status?.currentCycleBoosts ? `${status.currentCycleBoosts}x Boost Active!` : "Tap to Boost"}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.statsRow}>
          {gridCards.map((card) => (
            <View key={card.id} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {card.showDot && !loading && (
                <View style={[styles.statusDot, { backgroundColor: card.value === "Active" ? colors.primary : card.value === "Ready" ? "#ffd11a" : colors.mutedForeground, shadowColor: card.value === "Active" ? colors.primary : "#ffd11a" }]} />
              )}
              <View style={[styles.cardIconBox, { backgroundColor: card.color + "12" }]}>
                <Feather name={card.icon as any} size={12} color={card.color} />
              </View>
              {loading ? (
                <Skeleton width={45} height={14} borderRadius={3} style={{ marginVertical: 2 }} />
              ) : (
                <Text style={[styles.cardVal, { color: colors.foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{card.value}</Text>
              )}
              <Text style={[styles.cardLabel, { color: colors.mutedForeground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{card.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  neonBgGlow: { ...StyleSheet.absoluteFillObject },
  titleBlock: { marginBottom: 24 },
  pageTitle: { fontSize: 24, fontFamily: "Inter_700Bold" },
  pageSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4 },
  centerSection: { alignItems: "center", justifyContent: "center", marginVertical: 28 },
  orbContainer: { width: 350, height: 350, alignItems: "center", justifyContent: "center", position: "relative" },
  pulseRing: { position: "absolute", width: 290, height: 290, borderRadius: 145, borderWidth: 1.5, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 18, elevation: 4 },
  neonCircle: { width: 245, height: 245, borderRadius: 122.5, borderWidth: 3, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.85, shadowRadius: 15, elevation: 8 },
  stoneImage: { width: 155, height: 155 },
  cornerPill: { position: "absolute", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, minWidth: 96 },
  topLeft: { top: 22, left: -6 },
  topRight: { top: 22, right: -6 },
  bottomLeft: { bottom: 22, left: -6 },
  bottomRight: { bottom: 22, right: -6 },
  pillLabel: { fontSize: 9, fontFamily: "Inter_400Regular", lineHeight: 11 },
  pillValue: { fontSize: 11, fontFamily: "Inter_700Bold", lineHeight: 14 },
  controlsBlock: { gap: 12, marginBottom: 28 },
  claimBtn: { width: "100%", paddingVertical: 15, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", shadowColor: "#9fe870", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
  claimBtnContent: { flexDirection: "row", alignItems: "center", gap: 8 },
  claimBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  boostBtn: { width: "100%", paddingVertical: 14, borderRadius: 24, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, position: "relative", overflow: "hidden" },
  boostBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  statCard: { width: "23.5%", borderRadius: 16, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 4, gap: 3, alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" },
  cardIconBox: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 2 },
  statusDot: { position: "absolute", top: 6, right: 6, width: 6, height: 6, borderRadius: 3, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 3, elevation: 3 },
  cardVal: { fontSize: 11, fontFamily: "Inter_700Bold", textAlign: "center", width: "100%" },
  cardLabel: { fontSize: 9, fontFamily: "Inter_400Regular", textAlign: "center", width: "100%" },
});
