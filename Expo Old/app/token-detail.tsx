import React from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  StatusBar,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useToast } from "@/contexts/ToastContext";

export default function TokenDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const params = useLocalSearchParams<{
    name: string;
    symbol: string;
    balance: string;
    decimals: string;
    address: string;
    icon: string;
    fiatValue: string;
    change24h: string;
    networkName: string;
  }>();

  const isNative = !params.address;
  const change = parseFloat(params.change24h || "0");
  const fiatValue = parseFloat(params.fiatValue || "0");

  const handleCopyContract = async () => {
    if (!params.address) return;
    await Clipboard.setStringAsync(params.address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast("Contract address copied!", "success");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* Header gradient background */}
      <LinearGradient
        colors={["#163300", "#0e1a08", colors.background] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        {/* Top bar with back button */}
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: "rgba(255,255,255,0.08)" }]}
          >
            <Feather name="chevron-down" size={22} color="#f4f4f0" />
          </Pressable>
          <Text style={styles.topBarTitle}>Details</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Token Logo */}
        <View style={styles.logoSection}>
          <View style={[styles.logoOuter, { borderColor: colors.primary + "30" }]}>
            <LinearGradient
              colors={[colors.primaryPale, colors.primaryNeutral] as const}
              style={styles.logoGradient}
            >
              {params.icon ? (
                <Image
                  source={{ uri: params.icon }}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={[styles.logoFallback, { color: colors.primary }]}>
                  {(params.symbol || "?").slice(0, 3)}
                </Text>
              )}
            </LinearGradient>
          </View>

          {/* Glow behind logo */}
          <View style={[styles.logoGlow, { backgroundColor: colors.primary + "15" }]} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Token Name & Symbol */}
        <View style={styles.nameSection}>
          <Text style={[styles.tokenName, { color: colors.foreground }]}>
            {params.name || "Unknown Token"}
          </Text>
          <View style={[styles.symbolChip, { backgroundColor: colors.primary + "18" }]}>
            <Text style={[styles.symbolText, { color: colors.primary }]}>
              {params.symbol || "???"}
            </Text>
          </View>
        </View>

        {/* Balance */}
        <View style={styles.balanceSection}>
          <Text style={[styles.balanceAmount, { color: colors.foreground }]}>
            {params.balance || "0"}
          </Text>
          <Text style={[styles.balanceSymbol, { color: colors.mutedForeground }]}>
            {params.symbol}
          </Text>
        </View>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <View style={styles.infoLabelWrap}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Name</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {params.name || "Unknown"}
            </Text>
          </View>

          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabelWrap}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Symbol</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {params.symbol || "???"}
            </Text>
          </View>

          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabelWrap}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Contract</Text>
            </View>
            {isNative ? (
              <View style={[styles.nativeBadge, { backgroundColor: colors.primary + "18" }]}>
                <Feather name="shield" size={12} color={colors.primary} />
                <Text style={[styles.nativeBadgeText, { color: colors.primary }]}>Native</Text>
              </View>
            ) : (
              <Pressable onPress={handleCopyContract} style={styles.contractRow}>
                <Text style={[styles.contractAddress, { color: colors.foreground }]} numberOfLines={1}>
                  {`${params.address.slice(0, 10)}...${params.address.slice(-8)}`}
                </Text>
                <Feather name="copy" size={14} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>

          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabelWrap}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Decimals</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {params.decimals || "18"}
            </Text>
          </View>

          <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />

          <View style={styles.infoRow}>
            <View style={styles.infoLabelWrap}>
              <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Network</Text>
            </View>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {params.networkName || "Unknown"}
            </Text>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerGradient: {
    paddingBottom: 20,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#f4f4f0",
    letterSpacing: 0.3,
  },

  logoSection: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  logoOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  logoGradient: {
    width: "100%",
    height: "100%",
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 44,
  },
  logoFallback: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  logoGlow: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    zIndex: -1,
  },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  nameSection: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 4,
    gap: 8,
  },
  tokenName: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  symbolChip: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  symbolText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },

  balanceSection: {
    alignItems: "center",
    marginVertical: 20,
    gap: 2,
  },
  balanceAmount: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    letterSpacing: -1.5,
  },
  balanceSymbol: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  fiatValue: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 6,
  },

  infoCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    maxWidth: "55%",
    textAlign: "right",
  },
  infoDivider: {
    height: 1,
    opacity: 0.5,
  },

  nativeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  nativeBadgeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  contractRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "55%",
  },
  contractAddress: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    flexShrink: 1,
  },

  chartCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  chartLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  changeText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  chartArea: {
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  chartAreaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  actionBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  actionBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
