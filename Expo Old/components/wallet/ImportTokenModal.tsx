import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { ethers } from "ethers";
import { useColors } from "@/hooks/useColors";
import { useWalletMode } from "@/contexts/WalletModeContext";
import { TokenService } from "@/services/wallet/tokenService";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/contexts/ToastContext";
import { TokenAsset } from "@/services/wallet/types";

interface ImportTokenModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportTokenModal: React.FC<ImportTokenModalProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const colors = useColors();
  const { activeNetwork } = useWalletMode();
  const { user } = useAuth();
  const { toast } = useToast();
  const userId = user?.id || (user as any)?._id || "default_user";

  const [contractAddress, setContractAddress] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState("");
  const [isLoadingToken, setIsLoadingToken] = useState(false);

  const handlePasteAddress = async () => {
    const text = await Clipboard.getStringAsync();
    if (text) {
      setContractAddress(text.trim());
      lookupContract(text.trim());
    }
  };

  const lookupContract = async (addr: string) => {
    if (!ethers.isAddress(addr)) return;

    setIsLoadingToken(true);
    try {
      const provider = new ethers.JsonRpcProvider(activeNetwork.rpcUrl, activeNetwork.chainId, { staticNetwork: true });
      const info = await TokenService.fetchTokenInfo(addr, provider);
      if (info) {
        setTokenName(info.name);
        setTokenSymbol(info.symbol);
        setTokenDecimals(String(info.decimals));
      }
    } catch {
      /* keep fields as-is so user can fill manually */
    } finally {
      setIsLoadingToken(false);
    }
  };

  const canAdd = contractAddress.trim().length > 0 && tokenSymbol.trim().length > 0 && tokenName.trim().length > 0;

  const handleAddToken = async () => {
    if (!canAdd) return;
    try {
      await TokenService.addCustomToken(userId, activeNetwork.chainId, {
        symbol: tokenSymbol.trim(),
        name: tokenName.trim(),
        decimals: parseInt(tokenDecimals || "18", 10),
        address: contractAddress.trim(),
        isCustom: true,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`Imported token ${tokenSymbol.trim()}!`, "success");
      // Reset fields
      setContractAddress("");
      setTokenName("");
      setTokenSymbol("");
      setTokenDecimals("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast("Failed to import token: " + err.message, "error");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Import Token</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Contract Address */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Contract Address</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="0x..."
                placeholderTextColor={colors.mutedForeground}
                value={contractAddress}
                onChangeText={(text) => {
                  setContractAddress(text);
                  lookupContract(text);
                }}
                autoCapitalize="none"
              />
              <Pressable onPress={handlePasteAddress} style={styles.pasteIconBtn}>
                <Feather name="clipboard" size={16} color={colors.primary} />
              </Pressable>
            </View>

            {isLoadingToken && (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Fetching token info...</Text>
              </View>
            )}

            {/* Token Name */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Token Name</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Tether USD"
              placeholderTextColor={colors.mutedForeground}
              value={tokenName}
              onChangeText={setTokenName}
            />

            {/* Token Symbol */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Symbol</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. USDT"
              placeholderTextColor={colors.mutedForeground}
              value={tokenSymbol}
              onChangeText={setTokenSymbol}
              autoCapitalize="characters"
            />

            {/* Decimals */}
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Decimals</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="18"
              placeholderTextColor={colors.mutedForeground}
              value={tokenDecimals}
              onChangeText={setTokenDecimals}
              keyboardType="number-pad"
            />

            {/* Add Button */}
            <Pressable
              onPress={handleAddToken}
              disabled={!canAdd}
              style={[styles.addBtn, { backgroundColor: canAdd ? colors.primary : colors.muted }]}
            >
              <Text style={[styles.addBtnText, { color: canAdd ? colors.primaryForeground : colors.mutedForeground }]}>
                Add Custom Token
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20, height: 540 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { padding: 4 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6, marginTop: 4 },
  inputWrap: { flexDirection: "row", alignItems: "center", position: "relative", marginBottom: 12 },
  input: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, paddingLeft: 14, paddingRight: 40, fontSize: 14, fontFamily: "Inter_500Medium" },
  pasteIconBtn: { position: "absolute", right: 12, padding: 6 },
  fieldInput: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 12 },
  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  loadingText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  addBtn: { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 20 },
  addBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
