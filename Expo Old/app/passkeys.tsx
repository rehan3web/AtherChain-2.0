import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Passkey } from "react-native-passkey";

import { useColors } from "@/hooks/useColors";
import { useToast } from "@/contexts/ToastContext";
import { userApi, extractError } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

export default function PasskeysScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const handleRegisterPasskey = async () => {
    setPasskeyLoading(true);
    try {
      if (!Passkey.isSupported) {
        toast("Passkeys are not supported on this device.", "error");
        return;
      }
      
      const optionsRes = await userApi.passkeyRegisterOptions();
      const result = await Passkey.create(optionsRes);
      
      await userApi.passkeyRegisterVerify(result);
      toast("Passkey registered successfully", "success");
      await refreshUser();
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setPasskeyLoading(false);
    }
  };

  const handleRemovePasskey = async (credentialID: string) => {
    setPasskeyLoading(true);
    try {
      await userApi.passkeyRemove(credentialID);
      toast("Passkey removed successfully", "success");
      await refreshUser();
    } catch (err: any) {
      toast(extractError(err), "error");
    } finally {
      setPasskeyLoading(false);
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
              Passkeys
            </Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardSub, { color: colors.mutedForeground, marginBottom: 16 }]}>Login securely using FaceID or TouchID.</Text>

            {!(user as any)?.passkey_enabled && (
              <Pressable
                onPress={handleRegisterPasskey}
                style={[styles.outlineBtnLarge, { borderColor: colors.primary }]}
              >
                {passkeyLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.outlineBtnText, { color: colors.primary }]}>Register New Passkey</Text>}
              </Pressable>
            )}

            {(user as any)?.passkey_enabled && (user as any)?.passkey_credentials?.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Registered Passkeys</Text>
                {(user as any).passkey_credentials.map((cred: any, index: number) => (
                  <View key={cred.id} style={[styles.sessionItem, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={[styles.sessionIcon, { backgroundColor: colors.primaryPale }]}>
                      <Feather name="shield" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={[styles.sessionTitle, { color: colors.foreground }]} numberOfLines={1}>
                        Passkey {index + 1}
                      </Text>
                      <Text style={[styles.sessionSub, { color: colors.mutedForeground }]}>
                        {cred.id.substring(0, 16)}...
                      </Text>
                    </View>
                    <Pressable onPress={() => handleRemovePasskey(cred.id)}>
                      <Feather name="trash-2" size={18} color={colors.negative} />
                    </Pressable>
                  </View>
                ))}
                <Pressable
                  onPress={handleRegisterPasskey}
                  style={[styles.outlineBtnLarge, { borderColor: colors.border, marginTop: 24 }]}
                >
                  {passkeyLoading ? <ActivityIndicator size="small" color={colors.foreground} /> : <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>Add Another Passkey</Text>}
                </Pressable>
              </View>
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
  inputLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    marginBottom: 8,
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
  sessionSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
});
