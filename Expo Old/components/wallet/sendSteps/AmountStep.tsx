import React from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { TokenAsset } from "@/services/wallet/types";

interface AmountStepProps {
  amount: string;
  setAmount: (val: string) => void;
  selectedToken: TokenAsset | null;
  isEstimatingGas: boolean;
  onNext: () => void;
}

export const AmountStep: React.FC<AmountStepProps> = ({
  amount,
  setAmount,
  selectedToken,
  isEstimatingGas,
  onNext,
}) => {
  const colors = useColors();

  const cleanAmount = amount.replace(/,/g, ".");
  const amtNum = parseFloat(cleanAmount);
  const cleanBalance = (selectedToken?.balance || "0").replace(/,/g, "");
  const balNum = parseFloat(cleanBalance);
  const isValid = !isNaN(amtNum) && amtNum > 0 && amtNum <= balNum;

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Enter Amount</Text>

      <View style={styles.availableRow}>
        <Text style={[styles.availableLabel, { color: colors.mutedForeground }]}>Available </Text>
        <Text style={[styles.availableAmount, { color: colors.primary }]}>
          {selectedToken?.balance} {selectedToken?.symbol}
        </Text>
        <Pressable onPress={() => setAmount(selectedToken?.balance || "0")}>
          <Text style={[styles.maxBtnText, { color: colors.primary }]}>MAX</Text>
        </Pressable>
      </View>

      <View style={styles.bigInputContainer}>
        <TextInput
          style={[styles.bigInput, { color: colors.foreground }]}
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          autoFocus
        />
        <Text style={[styles.tickerLabel, { color: colors.mutedForeground }]}>{selectedToken?.symbol}</Text>
      </View>

      <Pressable
        onPress={onNext}
        disabled={isEstimatingGas || !isValid}
        style={[styles.nextBtn, { backgroundColor: (isValid || isEstimatingGas) ? colors.primary : colors.border }]}
      >
        {isEstimatingGas ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.nextBtnText, { color: isValid ? colors.primaryForeground : colors.mutedForeground }]}>Next: Confirm</Text>
        )}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  stepTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 20 },
  availableRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  availableLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  availableAmount: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  maxBtnText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  bigInputContainer: { flexDirection: "row", alignItems: "baseline", gap: 10, marginBottom: 24 },
  bigInput: { fontSize: 56, fontFamily: "Inter_700Bold" },
  tickerLabel: { fontSize: 22, fontFamily: "Inter_600SemiBold" },
  nextBtn: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 24 },
  nextBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
