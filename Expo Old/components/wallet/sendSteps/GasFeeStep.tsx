import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { FeeEstimate } from "@/services/wallet/types";

interface GasFeeStepProps {
  feeEstimates: { low: FeeEstimate; market: FeeEstimate; aggressive: FeeEstimate };
  selectedFee: FeeEstimate | null;
  setSelectedFee: (fee: FeeEstimate) => void;
  networkSymbol: string;
  onNext: () => void;
}

export const GasFeeStep: React.FC<GasFeeStepProps> = ({
  feeEstimates,
  selectedFee,
  setSelectedFee,
  networkSymbol,
  onNext,
}) => {
  const colors = useColors();

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Gas Fee Presets</Text>

      <View style={styles.presetStack}>
        {(["low", "market", "aggressive"] as const).map((presetKey) => {
          const presetObj = feeEstimates[presetKey];
          const isSel = selectedFee?.preset === presetKey;
          return (
            <Pressable
              key={presetKey}
              onPress={() => setSelectedFee(presetObj)}
              style={[
                styles.gasCard,
                { backgroundColor: colors.card, borderColor: isSel ? colors.primary : colors.border },
              ]}
            >
              <View style={styles.gasCardRow}>
                <Text style={[styles.presetName, { color: colors.foreground, textTransform: "capitalize" }]}>{presetKey}</Text>
                <Text style={[styles.presetVal, { color: colors.foreground }]}>
                  {presetObj.totalFeeNative} {networkSymbol}
                </Text>
              </View>
              <Text style={[styles.presetFiat, { color: colors.mutedForeground }]}>
                ≈ ${presetObj.totalFeeFiat?.toFixed(2)} USD
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={onNext}
        style={[styles.nextBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
      >
        <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>Confirm Fee</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  stepTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 20 },
  presetStack: { gap: 12, marginBottom: 16 },
  gasCard: { padding: 16, borderRadius: 18, borderWidth: 1, gap: 4 },
  gasCardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  presetName: { fontSize: 15, fontFamily: "Inter_700Bold" },
  presetVal: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  presetFiat: { fontSize: 12, fontFamily: "Inter_400Regular" },
  nextBtn: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 24 },
  nextBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
