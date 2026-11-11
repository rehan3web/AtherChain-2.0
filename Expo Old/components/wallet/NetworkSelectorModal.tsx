import React, { useState } from "react";
import {
  Image,
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
import { EVMNetwork } from "@/services/wallet/evmNetworks";

interface NetworkSelectorModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenAddCustom: () => void;
}

export const NetworkSelectorModal: React.FC<NetworkSelectorModalProps> = ({
  visible,
  onClose,
  onOpenAddCustom,
}) => {
  const colors = useColors();
  const {
    activeNetwork,
    setActiveNetwork,
    allNetworks,
    removeCustomNetwork,
  } = useWalletMode();

  const [search, setSearch] = useState("");

  const filtered = allNetworks.filter(
    (n) =>
      n.name.toLowerCase().includes(search.toLowerCase()) ||
      n.symbol.toLowerCase().includes(search.toLowerCase()) ||
      n.chainId.toString().includes(search)
  );

  const handleSelect = async (net: EVMNetwork) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await setActiveNetwork(net);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>Select Network</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <View style={[styles.searchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <TextInput
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder="Search by network name or chain ID..."
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
            />
          </View>


          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {filtered.map((net) => {
              const isSelected = activeNetwork.chainId === net.chainId;
              return (
                <Pressable
                  key={net.chainId}
                  onPress={() => handleSelect(net)}
                  style={[
                    styles.netRow,
                    { borderBottomColor: colors.border },
                    isSelected && { backgroundColor: colors.primaryPale + "44" },
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: colors.background }]}>
                    {net.icon ? (
                      <Image source={{ uri: net.icon }} style={styles.iconImg} />
                    ) : (
                      <Feather name="globe" size={18} color={colors.primary} />
                    )}
                  </View>

                  <View style={styles.netInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.netName, { color: colors.foreground }]}>{net.name}</Text>
                      {net.isCustom && (
                        <View style={[styles.testBadge, { backgroundColor: colors.primaryPale }]}>
                          <Text style={[styles.testBadgeText, { color: colors.primary }]}>Custom</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.netSub, { color: colors.mutedForeground }]}>
                      Chain ID: {net.chainId} • Symbol: {net.symbol}
                    </Text>
                  </View>

                  {net.isCustom && (
                    <Pressable
                      onPress={() => removeCustomNetwork(net.chainId)}
                      style={styles.delBtn}
                    >
                      <Feather name="trash-2" size={16} color={colors.destructive} />
                    </Pressable>
                  )}

                  {isSelected && <Feather name="check" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => {
              onClose();
              onOpenAddCustom();
            }}
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="plus" size={18} color={colors.primaryForeground} />
            <Text style={[styles.addBtnText, { color: colors.primaryForeground }]}>Add Custom Network</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: 20, maxHeight: "80%" },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.2)", alignSelf: "center", marginBottom: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  closeBtn: { padding: 4 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, height: 44, borderRadius: 14, borderWidth: 1, marginBottom: 14 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingHorizontal: 4 },
  toggleLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  list: { maxHeight: 320 },
  netRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  iconImg: { width: 36, height: 36 },
  netInfo: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  netName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  netSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  testBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  testBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  delBtn: { padding: 6, marginRight: 4 },
  addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 26, marginTop: 16 },
  addBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
