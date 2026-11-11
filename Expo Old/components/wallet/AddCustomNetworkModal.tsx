import React, { useRef, useState } from "react";
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
import { useColors } from "@/hooks/useColors";
import { useWalletMode } from "@/contexts/WalletModeContext";
import { validateRpcUrl, EVMNetwork } from "@/services/wallet/evmNetworks";
import { useToast } from "@/contexts/ToastContext";

interface AddCustomNetworkModalProps {
  visible: boolean;
  onClose: () => void;
}

export const AddCustomNetworkModal: React.FC<AddCustomNetworkModalProps> = ({
  visible,
  onClose,
}) => {
  const colors = useColors();
  const { addCustomNetwork } = useWalletMode();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [rpcUrl, setRpcUrl] = useState("");
  const [chainIdStr, setChainIdStr] = useState("");
  const [symbol, setSymbol] = useState("");
  const [explorerUrl, setExplorerUrl] = useState("");

  const [isValidating, setIsValidating] = useState(false);
  const [isFetchingChainId, setIsFetchingChainId] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchChainIdFromRpc = async (url: string) => {
    if (!url.trim().startsWith("http")) {
      setChainIdStr("");
      return;
    }
    setIsFetchingChainId(true);
    try {
      const res = await fetch(url.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
      });
      const json = await res.json();
      if (json.result) {
        const id = parseInt(json.result, 16);
        setChainIdStr(String(id));
      } else {
        setChainIdStr("");
      }
    } catch {
      setChainIdStr("");
    } finally {
      setIsFetchingChainId(false);
    }
  };

  const handleRpcUrlChange = (text: string) => {
    setRpcUrl(text);
    setChainIdStr("");
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => {
      fetchChainIdFromRpc(text);
    }, 600);
  };

  const handleAdd = async () => {
    if (!name.trim() || !rpcUrl.trim() || !chainIdStr.trim() || !symbol.trim()) {
      setErrorMessage("Please fill in all required fields.");
      return;
    }

    const chainId = parseInt(chainIdStr.trim(), 10);
    if (isNaN(chainId) || chainId <= 0) {
      setErrorMessage("Please enter a valid numeric Chain ID.");
      return;
    }

    setIsValidating(true);
    setErrorMessage("");

    try {
      const validation = await validateRpcUrl(rpcUrl.trim(), chainId);
      if (!validation.valid) {
        setErrorMessage(validation.error || "RPC URL validation failed.");
        return;
      }

      const newNet: EVMNetwork = {
        chainId,
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        rpcUrl: rpcUrl.trim(),
        explorerUrl: explorerUrl.trim() || undefined,
        isCustom: true,
      };

      await addCustomNetwork(newNet);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`Added custom network: ${newNet.name}`, "success");
      onClose();
    } catch (err: any) {
      setErrorMessage("Error validating network: " + err.message);
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Add Custom Network</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive }]}>
                <Feather name="alert-circle" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMessage}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Network Name *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="e.g. Polygon Mainnet"
                placeholderTextColor={colors.mutedForeground}
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>RPC URL *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="https://..."
                placeholderTextColor={colors.mutedForeground}
                value={rpcUrl}
                onChangeText={handleRpcUrlChange}
                autoCapitalize="none"
              />
            </View>

            <View style={styles.rowFields}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Chain ID *</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
                    placeholder={isFetchingChainId ? "Fetching..." : "Auto"}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="numeric"
                    value={chainIdStr}
                    editable={false}
                  />
                  {isFetchingChainId && (
                    <ActivityIndicator
                      size="small"
                      color={colors.primary}
                      style={{ position: "absolute", right: 12, top: 14 }}
                    />
                  )}
                </View>
              </View>

              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>Symbol *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="POL"
                  placeholderTextColor={colors.mutedForeground}
                  value={symbol}
                  onChangeText={setSymbol}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Block Explorer URL (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                placeholder="https://polygonscan.com"
                placeholderTextColor={colors.mutedForeground}
                value={explorerUrl}
                onChangeText={setExplorerUrl}
                autoCapitalize="none"
              />
            </View>

            <Pressable
              onPress={handleAdd}
              disabled={isValidating}
              style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            >
              {isValidating ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save & Switch</Text>
              )}
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20, maxHeight: "85%" },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { padding: 4 },
  content: { gap: 14 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 4 },
  errorText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_500Medium" },
  input: { height: 48, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontFamily: "Inter_500Medium" },
  rowFields: { flexDirection: "row", gap: 12 },
  saveBtn: { height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginTop: 12, marginBottom: 20 },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
