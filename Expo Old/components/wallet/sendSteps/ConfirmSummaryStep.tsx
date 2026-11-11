import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useColors } from "@/hooks/useColors";
import { TokenAsset, FeeEstimate } from "@/services/wallet/types";

interface ConfirmSummaryStepProps {
  amount: string;
  selectedToken: TokenAsset | null;
  networkName: string;
  networkSymbol: string;
  selectedFee: FeeEstimate | null;
  recipient: string;
  isConfirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmSummaryStep: React.FC<ConfirmSummaryStepProps> = ({
  amount,
  selectedToken,
  networkName,
  networkSymbol,
  selectedFee,
  recipient,
  isConfirming,
  onCancel,
  onConfirm,
}) => {
  const colors = useColors();

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Confirm Transfer</Text>

      <View style={[styles.confirmCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Amount</Text>
          <Text style={[styles.confirmVal, { color: colors.primary }]}>{amount} {selectedToken?.symbol}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Network</Text>
          <Text style={[styles.confirmVal, { color: colors.foreground }]}>{networkName}</Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>Max Gas Fee</Text>
          <Text style={[styles.confirmVal, { color: colors.foreground }]}>
            {selectedFee?.totalFeeNative} {networkSymbol}
          </Text>
        </View>
        <View style={styles.confirmRow}>
          <Text style={[styles.confirmLabel, { color: colors.mutedForeground }]}>To</Text>
          <Text style={[styles.confirmVal, { color: colors.foreground }]} numberOfLines={1}>{recipient}</Text>
        </View>
      </View>

      <View style={styles.btnRow}>
        <Pressable onPress={onCancel} style={[styles.halfBtn, { borderColor: colors.border, borderWidth: 1 }]} disabled={isConfirming}>
          <Text style={[styles.halfBtnText, { color: colors.foreground }]}>Cancel</Text>
        </Pressable>
        <Pressable onPress={onConfirm} style={[styles.halfBtn, { backgroundColor: colors.primary }]} disabled={isConfirming}>
          {isConfirming ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.halfBtnText, { color: colors.primaryForeground }]}>Sign & Send</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stepTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 20 },
  confirmCard: { padding: 20, borderRadius: 24, borderWidth: 1, gap: 16, marginBottom: 32 },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  confirmLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  confirmVal: { fontSize: 14, fontFamily: "Inter_600SemiBold", maxWidth: "60%" },
  btnRow: { flexDirection: "row", gap: 12 },
  halfBtn: { flex: 1, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  halfBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
