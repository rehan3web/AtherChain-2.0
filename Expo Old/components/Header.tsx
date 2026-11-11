import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import makeBlockie from "ethereum-blockies-base64";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import { notificationApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

type Notif = { id: string; title: string; message: string; created_at: string; read: boolean };

function getNotifStyle(title: string): { icon: string; color: string } {
  const t = title.toLowerCase();
  if (t.includes("reward") || t.includes("mining") || t.includes("earn")) return { icon: "gift", color: "#9fe870" };
  if (t.includes("security") || t.includes("alert") || t.includes("login")) return { icon: "shield", color: "#ffd11a" };
  if (t.includes("transfer") || t.includes("sent") || t.includes("receiv")) return { icon: "arrow-right", color: "#2ead4b" };
  if (t.includes("welcome")) return { icon: "box", color: "#9fe870" };
  if (t.includes("kyc") || t.includes("verif")) return { icon: "user-check", color: "#9fe870" };
  if (t.includes("swap")) return { icon: "repeat", color: "#9fe870" };
  return { icon: "bell", color: "#9fe870" };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function Header() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { user, profilePic } = useAuth();
  const router = useRouter();

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);

  const hasUnread = notifs.some((n) => !n.read);

  const fetchNotifs = async () => {
    setLoading(true);
    try {
      const data = await notificationApi.list();
      setNotifs(data);
    } catch {
      /* silent — show empty state */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showNotifications) fetchNotifs();
  }, [showNotifications]);

  const markOne = async (id: string) => {
    setNotifs((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await notificationApi.markAsRead(id); } catch { /* ignore */ }
  };

  const markAll = async () => {
    const unread = notifs.filter((n) => !n.read);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    for (const n of unread) {
      try { await notificationApi.markAsRead(n.id); } catch { /* ignore */ }
    }
  };


  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable style={[styles.avatar, { backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: "hidden" }]}>
          <Image source={{ uri: profilePic || makeBlockie(user?.walletAddress || (user as any)?.address || "0x4f2a9...d891") }} style={{ width: "100%", height: "100%" }} />
        </Pressable>
      </View>

      <View style={styles.headerRight}>
        <Pressable
          onPress={() => router.push("/(tabs)/scanner" as any)}
          style={[styles.themeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="maximize" size={16} color={colors.foreground} />
        </Pressable>

        <Pressable
          onPress={toggleTheme}
          style={[styles.themeToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name={isDark ? "sun" : "moon"} size={16} color={colors.foreground} />
        </Pressable>

        <Pressable
          onPress={() => setShowNotifications(true)}
          style={[styles.bell, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="bell" size={18} color={colors.foreground} />
          {hasUnread && <View style={[styles.bellDot, { backgroundColor: colors.negative }]} />}
        </Pressable>
      </View>


      {/* Notifications Modal */}
      <Modal
        visible={showNotifications}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowNotifications(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowNotifications(false)}>
          <View style={[styles.notifPanel, { backgroundColor: colors.card, borderColor: colors.border, marginTop: insets.top + 60 }]}>
            <View style={styles.notifHeader}>
              <Text style={[styles.notifTitle, { color: colors.foreground }]}>Notifications</Text>
              <Pressable onPress={() => setShowNotifications(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.notifScroll}>
              {loading ? (
                <ActivityIndicator color={colors.primary} style={{ paddingVertical: 32 }} />
              ) : notifs.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Feather name="bell-off" size={32} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No notifications yet</Text>
                </View>
              ) : (
                notifs.map((item) => {
                  const { icon, color } = getNotifStyle(item.title);
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => markOne(item.id)}
                      style={[styles.notifItem, { borderBottomColor: colors.border, opacity: item.read ? 0.6 : 1 }]}
                    >
                      <View style={[styles.notifIcon, { backgroundColor: color + "18" }]}>
                        <Feather name={icon as any} size={16} color={color} />
                      </View>
                      <View style={styles.notifBody}>
                        <View style={styles.notifRow}>
                          <Text style={[styles.notifItemTitle, { color: colors.foreground }]}>{item.title}</Text>
                          <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>{timeAgo(item.created_at)}</Text>
                        </View>
                        <Text style={[styles.notifDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                          {item.message}
                        </Text>
                      </View>
                      {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>

            {notifs.some((n) => !n.read) && (
              <Pressable onPress={markAll} style={styles.markAllBtn}>
                <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Inter_600SemiBold" }}>Mark all as read</Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  themeToggle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  bell: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 9, right: 9, width: 7, height: 7, borderRadius: 3.5 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", paddingHorizontal: 20 },

  notifPanel: { borderRadius: 24, borderWidth: 1, padding: 20, maxHeight: "65%", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  notifHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  notifTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  notifScroll: { marginHorizontal: -4 },
  notifItem: { flexDirection: "row", paddingVertical: 14, borderBottomWidth: 1, gap: 12, alignItems: "center" },
  notifIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  notifBody: { flex: 1, gap: 2 },
  notifRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  notifItemTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1, marginRight: 8 },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  notifDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  markAllBtn: { alignItems: "center", paddingTop: 16 },
  emptyWrap: { alignItems: "center", paddingVertical: 32, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
