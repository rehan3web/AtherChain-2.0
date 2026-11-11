import React, { useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { useWalletMode } from "@/contexts/WalletModeContext";
import { useToast } from "@/contexts/ToastContext";

interface Web3ReceiveModalProps {
  address: string;
  visible: boolean;
  onClose: () => void;
}

export const Web3ReceiveModal: React.FC<Web3ReceiveModalProps> = ({
  address,
  visible,
  onClose,
}) => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { activeNetwork } = useWalletMode();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(address)}&bgcolor=ffffff&color=000000`;

  const handleCopy = async () => {
    if (!address) return;
    await Clipboard.setStringAsync(address);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    toast("Address copied to clipboard!", "success");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({
        message: `My ${activeNetwork.name} address: ${address}`,
      });
    } catch { }
  };

  const displayValue = address && address.length > 16
    ? `${address.slice(0, 10)}...${address.slice(-10)}`
    : address;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ paddingHorizontal: 20 }}>
            <Header />

            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.foreground }]}>Receive Assets</Text>
            </View>

            <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.tabButton, { backgroundColor: colors.background, elevation: 2 }]}>
                <Text style={[styles.tabText, { color: colors.foreground }]}>
                  {activeNetwork.name} ({activeNetwork.symbol})
                </Text>
              </View>
            </View>

            <View style={[styles.qrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.qrWrapper, { borderColor: "#000000", backgroundColor: "#ffffff" }]}>
                <Image source={{ uri: qrUrl }} style={styles.qrImage} resizeMode="contain" />
              </View>

              <View style={styles.addressInfo}>
                <View style={[styles.addressBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.addressText, { color: colors.foreground }]} numberOfLines={1}>
                    {displayValue}
                  </Text>
                  <Pressable onPress={handleCopy} style={styles.copyIcon}>
                    <Feather name={copied ? "check" : "copy"} size={18} color={copied ? colors.positive : colors.primary} />
                  </Pressable>
                </View>
                {copied && (
                  <Text style={[styles.copiedText, { color: colors.positive }]}>Copied to clipboard!</Text>
                )}
              </View>

              <Text style={[styles.warningText, { color: colors.mutedForeground }]}>
                Only send {activeNetwork.name} ({activeNetwork.symbol}) network assets to this address. Sending assets from other networks may result in permanent loss.
              </Text>
            </View>

            <Pressable style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
              <Feather name="share-2" size={20} color={colors.primaryForeground} />
              <Text style={[styles.shareBtnText, { color: colors.primaryForeground }]}>Share My QR Code</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  titleRow: { marginTop: 8, marginBottom: 16 },
  title: { fontSize: 28, fontFamily: "Inter_700Bold" },
  tabContainer: { flexDirection: "row", borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 24 },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: "center" },
  tabText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  qrCard: { padding: 24, borderRadius: 24, borderWidth: 1, alignItems: "center" },
  qrWrapper: { padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
  qrImage: { width: 200, height: 200 },
  addressInfo: { width: "100%", marginBottom: 16 },
  addressBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 20, borderRadius: 16, borderWidth: 1, position: "relative", minHeight: 64 },
  addressText: { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center", width: "85%" },
  copyIcon: { position: "absolute", right: 12, padding: 8 },
  copiedText: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 8 },
  warningText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  shareBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 60, borderRadius: 30, marginTop: 24 },
  shareBtnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
