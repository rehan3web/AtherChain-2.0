import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";

function truncateAddress(hash: string): string {
  if (!hash || hash.length <= 20) return hash;
  return `${hash.slice(0, 9)}......${hash.slice(-4)}`;
}

export default function ReceiptScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();

  const {
    amount = "0.00 ATH",
    date = "Today",
    toAddress = "",
    fromAddress = "",
    type = "transfer",
    status = "completed",
    hash = "",
    timestamp = "",
    fee = "",
    blockNumber = "",
  } = params;

  let displayFrom = String(fromAddress);
  let displayTo = String(toAddress);
  const txType = String(type).toLowerCase();

  let displayTopAmount = String(amount);
  if (txType === "swap") {
    const numericAmount = String(amount).replace(/[^0-9.]/g, "");
    displayTopAmount = `+${numericAmount} ATH`;
  }

  if (txType === "swap") {
    const numericAmount = String(amount).replace(/[^0-9.]/g, "");
    displayFrom = `-${numericAmount} AT`;
    displayTo = `+${numericAmount} ATH`;
  } else if (txType === "send") {
    displayFrom = displayFrom || "Your Wallet";
    displayTo = displayTo || "Unknown";
  } else if (txType === "receive") {
    displayFrom = displayFrom || "Unknown";
    displayTo = displayTo || "Your Wallet";
  } else if (txType === "mining" || txType === "referral") {
    displayFrom = displayFrom || "System";
    displayTo = displayTo || "Your Wallet";
  }

  if (!displayFrom) displayFrom = "Network";
  if (!displayTo) displayTo = "Network";

  let displayDate = String(date);
  if (txType === "receive" || timestamp) {
    if (timestamp) {
      const parsed = new Date(String(timestamp));
      if (!isNaN(parsed.getTime())) {
        displayDate = parsed.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
      }
    }
  }

  const isFailed  = String(status).toLowerCase() === "failed";
  const isPending = String(status).toLowerCase() === "pending";

  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const handleCopyHash = async () => {
    if (!hash) return;
    await Clipboard.setStringAsync(String(hash));
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyItem = async (label: string, textToCopy: string) => {
    if (!textToCopy) return;
    await Clipboard.setStringAsync(textToCopy);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  let fromLabel = "From";
  let toLabel = "To";

  if (txType === "swap") {
    fromLabel = "You Send";
    toLabel = "You Receive";
  }

  const summaryItems: { label: string, value: string, copyText?: string }[] = [
    { label: "Date", value: displayDate },
    { label: "Type", value: String(type).charAt(0).toUpperCase() + String(type).slice(1) },
  ];

  if (blockNumber) {
    summaryItems.splice(1, 0, { label: "Block Number", value: String(blockNumber) });
  }

  summaryItems.push({ label: fromLabel, value: truncateAddress(displayFrom), copyText: displayFrom !== "Network" && displayFrom !== "System" ? displayFrom : undefined });
  summaryItems.push({ label: toLabel, value: truncateAddress(displayTo), copyText: displayTo !== "Network" && displayTo !== "System" ? displayTo : undefined });

  if (fee) {
    summaryItems.push({ label: "Gas Fee", value: String(fee) });
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 40) }]} bounces={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/wallet");
              }
            }}
            hitSlop={15}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.topSection}>
          <View style={styles.titleArea}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>
              Transaction
            </Text>
            <Text style={[styles.amountText, { color: colors.foreground }]}>
              {displayTopAmount}
            </Text>
          </View>
          <View style={styles.iconContainer}>
            <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: theme === 'dark' ? '#ffffff' : '#000000', alignItems: 'center', justifyContent: 'center' }}>
              <Image 
                source={theme === 'dark' ? require("../assets/images/logo.png") : require("../assets/images/secondary_logo.png")} 
                style={{ width: 44, height: 44 }} 
                resizeMode="contain"
              />
            </View>
            <View style={[styles.smallTickCircle, { backgroundColor: isFailed ? colors.negative : isPending ? colors.warning : '#22c55e', borderColor: colors.background }]}>
              <Feather name={isFailed ? "x" : isPending ? "clock" : "check"} size={14} color="#fff" />
            </View>
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        <View style={styles.referenceSection}>
          <View style={[styles.referenceCard, { backgroundColor: colors.card }]}>
            <View style={styles.referenceHeader}>
              <View style={styles.referenceTitleGroup}>
                <View style={styles.decorators}>
                  <View style={[styles.decoratorLine, { backgroundColor: colors.foreground }]} />
                  <View style={[styles.decoratorLine, { backgroundColor: colors.foreground }]} />
                  <View style={[styles.decoratorLine, { backgroundColor: colors.foreground }]} />
                </View>
                <Text style={[styles.referenceTitle, { color: colors.foreground }]}>
                  Reference
                </Text>
              </View>
              <Pressable
                onPress={handleCopyHash}
                hitSlop={15}
                style={styles.copyBtn}
              >
                <Feather name={copiedHash ? "check" : "copy"} size={16} color={copiedHash ? colors.primary : colors.foreground} />
              </Pressable>
            </View>
            <Text style={[styles.referenceHash, { color: colors.mutedForeground }]} selectable>
              {hash || "N/A"}
            </Text>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            Summary
          </Text>
          <View style={styles.summaryList}>
            {summaryItems.map((item) => (
              <View key={item.label} style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  {item.label}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
                  <Text style={[styles.summaryValue, { color: colors.foreground }]} numberOfLines={1} ellipsizeMode="middle">
                    {item.value}
                  </Text>
                  {item.copyText && (
                    <Pressable onPress={() => handleCopyItem(item.label, item.copyText!)} style={{ marginLeft: 8 }} hitSlop={10}>
                      <Feather name={copiedLabel === item.label ? "check" : "copy"} size={14} color={copiedLabel === item.label ? colors.primary : colors.mutedForeground} />
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  header: { alignItems: "flex-start", marginBottom: 40 },
  backBtn: { padding: 4, marginLeft: -4 },
  
  topSection: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  titleArea: { flex: 1, paddingRight: 16 },
  pageTitle: { fontSize: 20, fontFamily: "Inter_700Bold", lineHeight: 24 },
  amountText: { fontSize: 28, fontFamily: "Inter_700Bold", marginTop: 16, lineHeight: 34 },
  
  iconContainer: { position: "relative", width: 70, height: 70, flexShrink: 0 },
  smallTickCircle: { position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  
  separator: { height: 1, marginTop: 32, marginBottom: 24 },
  
  referenceSection: { marginBottom: 24 },
  referenceCard: { borderRadius: 16, padding: 20 },
  referenceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  referenceTitleGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  decorators: { gap: 3 },
  decoratorLine: { height: 1.5, width: 14, borderRadius: 1 },
  referenceTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", lineHeight: 16 },
  copyBtn: { marginTop: 0 },
  referenceHash: { marginTop: 16, fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 18, paddingRight: 24 },
  
  summarySection: { marginTop: 8 },
  summaryTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 24, lineHeight: 16 },
  summaryList: { gap: 48 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 14 },
  summaryValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 14, textAlign: "right" },
});
