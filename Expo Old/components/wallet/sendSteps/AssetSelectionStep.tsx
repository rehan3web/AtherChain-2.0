import React from "react";
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
import { TokenAsset } from "@/services/wallet/types";
import { useColors } from "@/hooks/useColors";

interface AssetSelectionStepProps {
  tokens: TokenAsset[];
  onSelect: (token: TokenAsset) => void;
}

export const AssetSelectionStep: React.FC<AssetSelectionStepProps> = ({ tokens, onSelect }) => {
  const colors = useColors();

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Select Asset</Text>
      
      <View style={styles.assetListContainer}>
        {tokens.map((tok, i) => (
          <Pressable
            key={tok.address || i}
            onPress={() => onSelect(tok)}
            style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.txIcon, { backgroundColor: colors.primaryPale }]}>
              {tok.icon ? (
                <Image source={{ uri: tok.icon }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 11, fontFamily: "Inter_700Bold", color: colors.primary }}>
                  {tok.symbol.slice(0, 3)}
                </Text>
              )}
            </View>
            <View style={styles.txBody}>
              <Text style={[styles.txName, { color: colors.foreground }]}>{tok.symbol}</Text>
              <Text style={[styles.txSub, { color: colors.mutedForeground }]}>{tok.name}</Text>
            </View>
            <View style={styles.txEnd}>
              <Text style={[styles.txAmount, { color: colors.foreground }]}>{tok.balance}</Text>
              <Text style={[styles.txDate, { color: colors.mutedForeground }]}>
                {`$${(tok.fiatValue || 0).toFixed(2)}`}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stepTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 20 },
  assetListContainer: { marginTop: 10, paddingBottom: 24 },
  txCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 12 },
  txIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14, overflow: "hidden" },
  txBody: { flex: 1 },
  txName: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 2 },
  txSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  txEnd: { alignItems: "flex-end" },
  txAmount: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  txDate: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
