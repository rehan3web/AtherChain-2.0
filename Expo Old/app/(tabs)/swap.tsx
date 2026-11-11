import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import Header from "@/components/Header";
import { swapApi, walletApi, extractError } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";
import Skeleton from "@/components/Skeleton";

function SwapSkeleton() {
  const colors = useColors();
  return (
    <View style={{ gap: 20 }}>
      {/* Top Swap box skeleton */}
      <View style={[styles.section, { gap: 14 }]}>
        <View style={styles.labelRow}>
          <Skeleton width={150} height={16} borderRadius={4} />
        </View>
        <View style={styles.inputRow}>
          <Skeleton width={50} height={32} borderRadius={6} />
          <Skeleton width={120} height={42} borderRadius={6} />
        </View>
      </View>

      {/* Divider line arrow skeleton */}
      <View style={styles.dividerContainer}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <View style={[styles.arrowCircle, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="arrow-down" size={16} color={colors.foreground} />
        </View>
      </View>

      {/* Bottom Swap box skeleton */}
      <View style={styles.section}>
        <View style={styles.inputRow}>
          <Skeleton width={60} height={32} borderRadius={6} />
          <Skeleton width={100} height={42} borderRadius={6} />
        </View>
      </View>

      {/* Info card skeleton */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.infoRow}>
          <Skeleton width={100} height={14} borderRadius={4} />
          <Skeleton width={120} height={14} borderRadius={4} />
        </View>
        <View style={styles.infoRow}>
          <Skeleton width={80} height={14} borderRadius={4} />
          <Skeleton width={40} height={14} borderRadius={4} />
        </View>
      </View>
    </View>
  );
}

export default function SwapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 60 : insets.top;
  const { toast } = useToast();

  const [amount, setAmount] = useState("0.00");
  const [atBalance, setAtBalance] = useState("0.00");
  const [swapRate, setSwapRate] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [walletStats, rateData] = await Promise.all([
        walletApi.stats(),
        swapApi.rate(),
      ]);
      setAtBalance(walletStats?.at_balance ?? "0.00");
      setSwapRate(parseFloat(rateData?.rate ?? "1") || 1);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAmountChange = (text: string) => {
    if (text.includes("-")) { setAmount("0.00"); return; }
    let val = text.replace(/[^0-9.]/g, "");
    if (amount === "0.00" && val !== "0.00" && val.length > 0) {
      if (val.startsWith("0.00")) val = val.substring(4);
      else if (val.endsWith("0.00")) val = val.substring(0, val.length - 4);
    }
    if ((val.match(/\./g) || []).length > 1) return;
    if (val.length > 1 && val.startsWith("0") && val[1] !== ".") val = val.substring(1);
    setAmount(val || "0.00");
  };

  const handleMax = () => {
    setAmount(atBalance);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSwap = async () => {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum <= 0) {
      toast("Please enter a valid amount to swap.", "warning");
      return;
    }
    if (amountNum > parseFloat(atBalance)) {
      toast(`Insufficient balance. You only have ${atBalance} AT available.`, "error");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    router.push({
      pathname: "/review_swap",
      params: { amount: amountNum.toString(), swapRate: swapRate.toString() }
    });
  };

  const receivedAmount = parseFloat(amount) > 0 ? (parseFloat(amount) * swapRate).toFixed(4) : "0.00";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Header />

        <View style={styles.swapContainer}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Swap</Text>

          {loading ? (
            <SwapSkeleton />
          ) : (
            <>
              <View style={styles.section}>
                <View style={styles.labelRow}>
                  <View style={styles.balanceWrap}>
                    <Text style={[styles.balanceText, { color: colors.mutedForeground }]}>Balance: {parseFloat(atBalance).toFixed(4)} AT</Text>
                    <Pressable onPress={handleMax} style={[styles.maxBtn, { backgroundColor: colors.primaryPale }]}>
                      <Text style={[styles.maxBtnText, { color: colors.primary }]}>Max</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={styles.inputRow}>
                  <Text style={[styles.tokenLabel, { color: colors.foreground }]}>AT</Text>
                  <TextInput
                    style={[styles.mainInput, { color: colors.foreground }]}
                    value={amount}
                    onChangeText={handleAmountChange}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.mutedForeground}
                    selectTextOnFocus
                  />
                </View>
              </View>

              <View style={styles.dividerContainer}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <View style={[styles.arrowCircle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Feather name="arrow-down" size={16} color={colors.foreground} />
                </View>
              </View>

              <View style={styles.section}>
                <View style={styles.inputRow}>
                  <Text style={[styles.tokenLabel, { color: colors.foreground }]}>ATH</Text>
                  <Text style={[styles.calculatedValue, { color: colors.foreground }]}>{receivedAmount}</Text>
                </View>
              </View>

              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Exchange Rate</Text>
                  <Text style={[styles.infoValue, { color: colors.foreground }]}>1 AT = {swapRate} ATH</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Network Fee</Text>
                  <Text style={[styles.infoValue, { color: colors.positive }]}>Free</Text>
                </View>
              </View>
            </>
          )}
        </View>

        <Pressable
          style={[styles.swapBtn, { backgroundColor: submitting ? colors.border : colors.primary, opacity: loading ? 0.5 : 1 }]}
          onPress={handleSwap}
          disabled={submitting || loading}
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.swapBtnText, { color: colors.primaryForeground }]}>Review Swap</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  swapContainer: { marginTop: 24, marginBottom: 32 },
  pageTitle: { fontSize: 32, fontFamily: "Inter_700Bold", marginBottom: 32 },
  section: { paddingVertical: 10 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  balanceWrap: { flexDirection: "row", alignItems: "center", gap: 10 },
  balanceText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  maxBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  maxBtnText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  inputRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  tokenLabel: { fontSize: 24, fontFamily: "Inter_600SemiBold" },
  mainInput: { fontSize: 36, fontFamily: "Inter_700Bold", flex: 1, textAlign: "right", padding: 0 },
  calculatedValue: { fontSize: 36, fontFamily: "Inter_700Bold", textAlign: "right" },
  dividerContainer: { height: 60, justifyContent: "center", alignItems: "center", position: "relative" },
  dividerLine: { height: 1, width: "100%", position: "absolute" },
  arrowCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", zIndex: 1 },
  infoCard: { marginTop: 40, padding: 20, borderRadius: 20, borderWidth: 1, gap: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  infoValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  swapBtn: { height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  swapBtnText: { fontSize: 17, fontFamily: "Inter_700Bold" },
});
