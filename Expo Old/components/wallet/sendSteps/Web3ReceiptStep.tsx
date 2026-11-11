import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";

interface Web3ReceiptStepProps {
  amount: string;
  symbol: string;
  txHash: string;
  toAddress: string;
  fromAddress?: string;
  gasFee?: string;
  blockNumber?: string;
  networkName: string;
  onDone: () => void;
}

function truncateAddress(hash: string): string {
  if (!hash || hash.length <= 15) return hash;
  return `${hash.slice(0, 9)}......${hash.slice(-4)}`;
}

export const Web3ReceiptStep: React.FC<Web3ReceiptStepProps> = ({
  amount,
  symbol,
  txHash,
  toAddress,
  fromAddress,
  gasFee,
  blockNumber,
  networkName,
  onDone,
}) => {
  const colors = useColors();
  const { theme } = useTheme();
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const displayTopAmount = `-${amount} ${symbol}`;
  const displayDate = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const handleCopyHash = async () => {
    if (!txHash) return;
    await Clipboard.setStringAsync(String(txHash));
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const handleCopyItem = async (label: string, textToCopy?: string) => {
    if (!textToCopy) return;
    await Clipboard.setStringAsync(textToCopy);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  const summaryItems = [
    { label: "Date", value: displayDate },
    { label: "Block Number", value: blockNumber || "Pending" },
    { label: "Network", value: networkName },
    { label: "Type", value: "Send" },
    { label: "From", value: truncateAddress(fromAddress || ""), copyText: fromAddress },
    { label: "To", value: truncateAddress(toAddress), copyText: toAddress },
    { label: "Gas Fee", value: gasFee || "N/A" },
  ];

  return (
    <View style={styles.root}>
      <View style={styles.topSection}>
        <View style={styles.titleArea}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>Transaction</Text>
          <Text style={[styles.amountText, { color: colors.foreground }]}>{displayTopAmount}</Text>
        </View>
        <View style={styles.iconContainer}>
          <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: theme === 'dark' ? '#ffffff' : '#000000', alignItems: 'center', justifyContent: 'center' }}>
            <Image 
              source={theme === 'dark' ? require("../../../assets/images/logo.png") : require("../../../assets/images/secondary_logo.png")} 
              style={{ width: 44, height: 44 }} 
              resizeMode="contain"
            />
          </View>
          <View style={[styles.smallTickCircle, { backgroundColor: '#22c55e', borderColor: colors.background }]}>
            <Feather name="check" size={14} color="#fff" />
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
              <Text style={[styles.referenceTitle, { color: colors.foreground }]}>Reference</Text>
            </View>
            <Pressable onPress={handleCopyHash} hitSlop={15} style={styles.copyBtn}>
              <Feather name={copiedHash ? "check" : "copy"} size={16} color={copiedHash ? colors.primary : colors.foreground} />
            </Pressable>
          </View>
          <Text style={[styles.referenceHash, { color: colors.mutedForeground }]} selectable>
            {txHash || "N/A"}
          </Text>
        </View>
      </View>

      <View style={styles.summarySection}>
        <Text style={[styles.summaryTitle, { color: colors.foreground }]}>Summary</Text>
        <View style={styles.summaryList}>
          {summaryItems.map((item) => (
            <View key={item.label} style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", flex: 1, justifyContent: "flex-end" }}>
                <Text style={[styles.summaryValue, { color: colors.foreground }]} numberOfLines={1} ellipsizeMode="middle">
                  {item.value}
                </Text>
                {item.copyText && (
                  <Pressable onPress={() => handleCopyItem(item.label, item.copyText)} style={{ marginLeft: 8 }} hitSlop={10}>
                    <Feather name={copiedLabel === item.label ? "check" : "copy"} size={14} color={copiedLabel === item.label ? colors.primary : colors.mutedForeground} />
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>

      <Pressable onPress={onDone} style={[styles.nextBtn, { backgroundColor: colors.primary }]}>
        <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Done</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, paddingBottom: 20 },
  topSection: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 },
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
  nextBtn: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 40 },
  nextBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
