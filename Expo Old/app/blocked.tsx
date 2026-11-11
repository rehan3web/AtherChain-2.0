import React from "react";
import { View, Text, StyleSheet, Pressable, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

export default function BlockedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setIsBlocked } = useAuth();
  const router = useRouter();

  const handleSupport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Linking.openURL("mailto:support@atherchain.tech");
  };

  const handleLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsBlocked(false);
    router.replace("/login");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: "rgba(239, 68, 68, 0.1)" }]}>
            <Feather name="slash" size={48} color="#ef4444" />
          </View>
        </View>
        
        <Text style={[styles.title, { color: colors.foreground }]}>
          Account Blocked
        </Text>
        
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Your account has been temporarily or permanently blocked by an administrator. Please contact support if you believe this is an error.
        </Text>

        <View style={styles.buttonContainer}>
          <Pressable 
            onPress={handleSupport} 
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          >
            <Feather name="mail" size={18} color={colors.primaryForeground} />
            <Text style={[styles.primaryBtnText, { color: colors.primaryForeground }]}>
              Go to Support
            </Text>
          </Pressable>

          <Pressable 
            onPress={handleLogin} 
            style={[styles.outlineBtn, { borderColor: colors.border }]}
          >
            <Text style={[styles.outlineBtnText, { color: colors.foreground }]}>
              Back to Login
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 32,
    alignItems: "center",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 16,
  },
  buttonContainer: {
    width: "100%",
    gap: 16,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  outlineBtn: {
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
