import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";

import { useColors } from "@/hooks/useColors";
import { useToast } from "@/contexts/ToastContext";
import { authApi, extractError } from "@/services/api";

export default function SessionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();

  const { data: sessions = [], isLoading: loadingSessions, refetch } = useQuery<any[]>({
    queryKey: ["activeSessions"],
    queryFn: async () => {
      const data = await authApi.getSessions();
      return Array.isArray(data) ? data : (data?.sessions ?? []);
    },
    staleTime: 30000,
  });

  const [removingAll, setRemovingAll] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const handleRemoveAll = async () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      setTimeout(() => setConfirmLogout(false), 4000);
      return;
    }
    setConfirmLogout(false);
    setRemovingAll(true);
    try {
      await authApi.removeAllSessions();
      await refetch();
      toast("All other sessions have been removed.", "success");
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setRemovingAll(false);
    }
  };

  const handleRemoveSession = async (sessionId: string) => {
    try {
      await authApi.removeSession(sessionId);
      await refetch();
    } catch (err: any) {
      toast(extractError(err), "error");
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 40, paddingBottom: Math.max(insets.bottom, 40) }]} bounces={false}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={15}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
        </View>

        <View style={styles.topSection}>
          <View style={styles.titleArea}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>
              Active Sessions
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardSub, { color: colors.mutedForeground, marginBottom: 16 }]}>Manage devices where your account is currently logged in.</Text>

            <Pressable onPress={handleRemoveAll} disabled={removingAll} style={[styles.outlineBtnLarge, { borderColor: confirmLogout ? "#ef4444" : colors.border, marginBottom: 20, backgroundColor: confirmLogout ? "rgba(239,68,68,0.08)" : "transparent" }]}>
              {removingAll
                ? <ActivityIndicator color={colors.negative} size="small" />
                : <Text style={[styles.outlineBtnText, { color: colors.negative, fontFamily: "Inter_600SemiBold" }]}>
                    {confirmLogout ? "Tap again to confirm log out" : "Log Out All Other Devices"}
                  </Text>
              }
            </Pressable>

            {loadingSessions ? (
              <ActivityIndicator color={colors.primary} />
            ) : sessions.length === 0 ? (
              <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>No active sessions found.</Text>
            ) : (
              sessions.map((session, i) => (
                <View key={session.id ?? i} style={[styles.sessionItem, i > 0 && { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <View style={[styles.sessionIcon, { backgroundColor: colors.primaryPale }]}>
                    <Feather name="monitor" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {session.userAgent ?? "Unknown Device"}
                    </Text>
                    <View style={styles.sessionRow}>
                      {session.isCurrent && <Text style={[styles.currentLabel, { color: colors.primary }]}>Current Session</Text>}
                      <Text style={[styles.sessionSub, { color: colors.mutedForeground }]}>{session.ip ?? ""}</Text>
                    </View>
                    {session.createdAt && (
                      <Text style={[styles.sessionTime, { color: colors.mutedForeground }]}>
                        {new Date(session.createdAt).toLocaleString()}
                      </Text>
                    )}
                  </View>
                  {!session.isCurrent && (
                    <Pressable onPress={() => handleRemoveSession(session.id)}>
                      <Feather name="x" size={18} color={colors.negative} />
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(150,150,150,0.1)",
  },
  topSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  titleArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: "Outfit_700Bold",
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
  },
  cardSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  outlineBtnLarge: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  outlineBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  currentLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
  },
  sessionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  sessionTime: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
