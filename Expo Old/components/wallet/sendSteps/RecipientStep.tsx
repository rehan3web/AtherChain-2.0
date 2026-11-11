import React from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { ethers } from "ethers";

interface RecipientStepProps {
  recipient: string;
  onChangeText: (text: string) => void;
  isResolvingEns: boolean;
  ensName: string;
  onPaste: () => void;
  onScan: () => void;
  onNext: () => void;
  networkName: string;
}

export const RecipientStep: React.FC<RecipientStepProps> = ({
  recipient,
  onChangeText,
  isResolvingEns,
  ensName,
  onPaste,
  onScan,
  onNext,
  networkName,
}) => {
  const colors = useColors();

  return (
    <View>
      <Text style={[styles.stepTitle, { color: colors.foreground }]}>Recipient Address</Text>
      <View style={styles.minimalInputContainer}>
        <View style={[styles.inputRowContainer, { borderBottomColor: colors.border }]}>
          <TextInput
            style={[styles.minimalInput, { color: colors.foreground }]}
            placeholder={`Enter ${networkName} address or name.eth...`}
            placeholderTextColor={colors.mutedForeground}
            value={recipient}
            onChangeText={onChangeText}
            autoFocus
            autoCapitalize="none"
          />
          <View style={styles.inputActionIcons}>
            <Pressable onPress={onPaste} style={styles.iconActionBtn} hitSlop={8}>
              <Feather name="clipboard" size={20} color={colors.primary} />
            </Pressable>
            <Pressable onPress={onScan} style={styles.iconActionBtn} hitSlop={8}>
              <Feather name="camera" size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </View>

      {isResolvingEns && (
        <Text style={[styles.ensText, { color: colors.primary }]}>Resolving ENS name...</Text>
      )}
      {ensName ? (
        <Text style={[styles.ensText, { color: colors.positive }]}>Resolved: {ensName}</Text>
      ) : null}
      
      {recipient.length > 0 && !isResolvingEns && !ensName && !ethers.isAddress(String(recipient.trim())) && !ethers.isAddress(String(recipient.trim()).toLowerCase()) && !String(recipient.trim()).endsWith(".eth") && (
        <Text style={[styles.ensText, { color: colors.negative }]}>Invalid EVM address format</Text>
      )}

      <Pressable
        onPress={onNext}
        disabled={!recipient}
        style={[styles.nextBtn, { backgroundColor: recipient ? colors.primary : colors.border }]}
      >
        <Text style={[styles.nextBtnText, { color: recipient ? colors.primaryForeground : colors.mutedForeground }]}>Next</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  stepTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 20 },
  minimalInputContainer: { marginBottom: 32 },
  inputRowContainer: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingVertical: 4 },
  minimalInput: { flex: 1, fontSize: 16, fontFamily: "Inter_500Medium", paddingVertical: 10, paddingRight: 8 },
  inputActionIcons: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconActionBtn: { padding: 6, borderRadius: 8 },
  ensText: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
  nextBtn: { height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginTop: 24 },
  nextBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
