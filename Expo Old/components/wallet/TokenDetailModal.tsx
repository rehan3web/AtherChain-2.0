import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { TokenAsset } from "@/services/wallet/types";
import { useWalletMode } from "@/contexts/WalletModeContext";

interface TokenDetailModalProps {
  token: TokenAsset | null;
  visible: boolean;
  onClose: () => void;
  onSend: (token: TokenAsset) => void;
  onReceive: (token: TokenAsset) => void;
}

export const TokenDetailModal: React.FC<TokenDetailModalProps> = ({
  token,
  visible,
  onClose,
  onSend,
  onReceive,
}) => {
  const colors = useColors();
  const { activeNetwork } = useWalletMode();

  if (!token) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
          <View style={styles.handleBar} />
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={[styles.title, { color: colors.foreground }]}>{token.name}</Text>
              <Text style={[styles.symbolBadge, { color: colors.primary }]}>{token.symbol}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={styles.balanceBox}>
              <Text style={[styles.balBig, { color: colors.foreground }]}>{token.balance}</Text>
              <Text style={[styles.balTicker, { color: colors.mutedForeground }]}>{token.symbol}</Text>
              <Text style={[styles.fiatVal, { color: colors.primary }]}>
                ≈ ${token.fiatValue ? token.fiatValue.toFixed(2) : "0.00"} USD
              </Text>
            </View>

            {/* Simulated 7-day mini chart preview */}
            <View style={[styles.chartCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={styles.chartHeader}>
                <Text style={[styles.chartLabel, { color: colors.mutedForeground }]}>7D Performance</Text>
                <Text style={[styles.chartChange, { color: (token.change24h || 0) >= 0 ? colors.positive : colors.negative }]}>
                  {(token.change24h || 0) >= 0 ? "+" : ""}{(token.change24h || 1.5).toFixed(2)}%
                </Text>
              </View>
              <View style={styles.chartPlaceholder}>
                <Feather name="trending-up" size={32} color={colors.primary} />
                <Text style={[styles.chartPlaceholderText, { color: colors.mutedForeground }]}>
                  Live Chart Active on {activeNetwork.name}
                </Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => {
                  onClose();
                  onSend(token);
                }}
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              >
                <Feather name="arrow-up-right" size={18} color={colors.primaryForeground} />
                <Text style={[styles.actionBtnText, { color: colors.primaryForeground }]}>Send</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  onClose();
                  onReceive(token);
                }}
                style={[styles.actionBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border }]}
              >
                <Feather name="arrow-down-left" size={18} color={colors.foreground} />
                <Text style={[styles.actionBtnText, { color: colors.foreground }]}>Receive</Text>
              </Pressable>
            </View>

            <View style={styles.infoSection}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Token Info</Text>
              <View style={[styles.infoCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Network</Text>
                  <Text style={[styles.infoVal, { color: colors.foreground }]}>{activeNetwork.name}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Decimals</Text>
                  <Text style={[styles.infoVal, { color: colors.foreground }]}>{token.decimals}</Text>
                </View>
                {token.address && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Contract</Text>
                    <Text style={[styles.infoVal, { color: colors.foreground }]} numberOfLines={1}>
                      {`${token.address.slice(0, 8)}...${token.address.slice(-6)}`}
                    </Text>
                  </View>
                )}
              </View>
            </View>
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
  titleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 20, fontFamily: "Inter_700Bold" },
  symbolBadge: { fontSize: 13, fontFamily: "Inter_700Bold" },
  closeBtn: { padding: 4 },
  balanceBox: { alignItems: "center", marginVertical: 14 },
  balBig: { fontSize: 36, fontFamily: "Inter_700Bold" },
  balTicker: { fontSize: 14, fontFamily: "Inter_500Medium", marginTop: 2 },
  fiatVal: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  chartCard: { padding: 16, borderRadius: 20, borderWidth: 1, marginVertical: 14 },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  chartLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  chartChange: { fontSize: 13, fontFamily: "Inter_700Bold" },
  chartPlaceholder: { height: 70, alignItems: "center", justifyContent: "center", gap: 6 },
  chartPlaceholderText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  actionRow: { flexDirection: "row", gap: 12, marginVertical: 14 },
  actionBtn: { flex: 1, height: 50, borderRadius: 25, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  infoSection: { marginTop: 10, gap: 8 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  infoCard: { padding: 14, borderRadius: 18, borderWidth: 1, gap: 10 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  infoLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  infoVal: { fontSize: 13, fontFamily: "Inter_600SemiBold", maxWidth: "60%" },
});
