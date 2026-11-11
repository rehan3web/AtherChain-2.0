import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { useToast } from "@/contexts/ToastContext";
import { userApi, extractError } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

export default function ChangePasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();

  const [current, setCurrent] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const handleChange = async () => {
    if (!current || !newPwd || !confirm) {
      toast("Please fill in all fields.", "warning");
      return;
    }
    if (newPwd !== confirm) {
      toast("New password and confirmation do not match.", "error");
      return;
    }
    if (newPwd.length < 8) {
      toast("Password must be at least 8 characters.", "warning");
      return;
    }

    setSaving(true);
    try {
      await userApi.changePassword(current, newPwd);
      toast("Password changed successfully.", "success");
      setCurrent(""); setNewPwd(""); setConfirm("");
      router.back();
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setSaving(false);
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
              Change Password
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardSub, { color: colors.mutedForeground, marginBottom: 20 }]}>
              Ensure your account is using a long, random password to stay secure.
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Current Password</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                secureTextEntry value={current} onChangeText={setCurrent}
                placeholder="••••••••" placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>New Password</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                secureTextEntry value={newPwd} onChangeText={setNewPwd}
                placeholder="••••••••" placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Confirm New Password</Text>
              <TextInput
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
                secureTextEntry value={confirm} onChangeText={setConfirm}
                placeholder="••••••••" placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {newPwd && confirm && newPwd !== confirm && (
              <Text style={{ color: colors.negative, fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 12 }}>Passwords do not match</Text>
            )}

            <Pressable onPress={handleChange} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary, marginTop: 10 }]}>
              {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Update Password</Text>}
            </Pressable>
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
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  saveBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 8,
  },
  saveBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
});
