import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { walletApi } from "@/services/api";

type TabId = "username" | "email" | "address";

export default function ReceiveScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>("address");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    walletApi.stats().then((stats) => {
      setWalletAddress(stats?.wallet_address ?? "");
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const tabs = [
    { id: "username" as TabId, label: "Username", value: user?.username ? `@${user.username}` : "@—" },
    { id: "email" as TabId, label: "Email", value: user?.email ?? "—" },
    { id: "address" as TabId, label: "Address", value: walletAddress || "—" },
  ];

  const currentTab = tabs.find((t) => t.id === activeTab)!;
  const qrValue = currentTab.value !== "—" ? currentTab.value : "ather";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrValue)}&bgcolor=ffffff&color=000000`;

  const handleCopy = async () => {
    if (currentTab.value === "—") return;
    await Clipboard.setStringAsync(currentTab.value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Share.share({ message: `My Ather Network ${currentTab.label}: ${currentTab.value}` });
    } catch {}
  };

  const displayValue = activeTab === "address" && currentTab.value.length > 16
    ? `${currentTab.value.slice(0, 10)}...${currentTab.value.slice(-10)}`
    : currentTab.value;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ paddingHorizontal: 20 }}>
          <Header />

          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>Receive Assets</Text>
          </View>

          <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setActiveTab(tab.id);
                  setCopied(false);
                }}
                style={[styles.tabButton, activeTab === tab.id && { backgroundColor: colors.background, elevation: 2 }]}
              >
                <Text style={[styles.tabText, { color: activeTab === tab.id ? colors.foreground : colors.mutedForeground }]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {loading ? (
            <View style={[styles.qrCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 80 }} />
            </View>
          ) : (
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
                Only send ATH assets to this address. Sending other assets may result in permanent loss.
              </Text>
            </View>
          )}

          <Pressable style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={handleShare}>
            <Feather name="share-2" size={20} color={colors.primaryForeground} />
            <Text style={[styles.shareBtnText, { color: colors.primaryForeground }]}>Share My QR Code</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.tabBar, { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder, paddingBottom: insets.bottom }]}>
        {[
          { id: "index", label: "Home", icon: "home" },
          { id: "node", label: "Node", icon: "cpu" },
          { id: "swap", label: "Swap", icon: "repeat", isCenter: true },
          { id: "wallet", label: "Wallet", icon: "credit-card" },
          { id: "referral", label: "Referral", icon: "users" },
        ].map((tab) => (
          <Pressable key={tab.id} onPress={() => router.replace(`/(tabs)/${tab.id === "index" ? "" : tab.id}` as any)} style={styles.tabItem}>
            {tab.isCenter ? (
              <View style={[styles.centerCircle, { backgroundColor: colors.primary }]}>
                <Feather name={tab.icon as any} size={22} color={colors.primaryForeground} />
              </View>
            ) : (
              <Feather name={tab.icon as any} size={20} color={colors.mutedForeground} />
            )}
            <Text style={[styles.tabLabel, { color: colors.mutedForeground }]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  titleRow: { marginTop: 12, marginBottom: 24 },
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
  tabBar: { flexDirection: "row", alignItems: "center", borderTopWidth: 1, paddingTop: 8, position: "absolute", bottom: 0, left: 0, right: 0 },
  tabItem: { flex: 1, alignItems: "center", gap: 3, paddingBottom: 4 },
  tabLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  centerCircle: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", marginTop: -20 },
});
