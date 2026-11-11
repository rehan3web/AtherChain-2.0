import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Linking from "expo-linking";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { PermissionStatus, requestNotificationPermission } from "@/hooks/useNotificationPermission";

type Props = {
  status: PermissionStatus;
  onRefresh: () => void;
};

export default function NotificationGate({ status, onRefresh }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const pulse  = useRef(new Animated.Value(1)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.12, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.00, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const isDenied = status === "denied";

  const handleAllow = async () => {
    if (isDenied) {
      if (Platform.OS === "web") {
        alert("Please enable notifications in your browser settings, then reload the page.");
      } else {
        await Linking.openSettings();
        setTimeout(onRefresh, 1500);
      }
      return;
    }
    const result = await requestNotificationPermission();
    if (result !== "granted") {
      onRefresh();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
      <Animated.View style={[styles.inner, { opacity: fadeIn }]}>

        <View style={styles.topSection}>
          <Animated.View style={[styles.iconRing, { borderColor: colors.primaryNeutral, transform: [{ scale: pulse }] }]}>
            <LinearGradient
              colors={["#163300", "#0e1a08", "#1a2e10"]}
              style={styles.iconGradient}
            >
              <Feather name="bell" size={36} color={colors.primary} />
            </LinearGradient>
          </Animated.View>

          <View style={[styles.badge, { backgroundColor: colors.primaryPale, borderColor: colors.border }]}>
            <Feather name="alert-circle" size={13} color={colors.primary} />
            <Text style={[styles.badgeText, { color: colors.primary }]}>Action Required</Text>
          </View>
        </View>

        <View style={styles.textSection}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Allow Notifications</Text>
          <Text style={[styles.sub, { color: colors.mutedForeground }]}>
            {isDenied
              ? "Notifications are blocked. Please enable them in your device settings to receive mining alerts and important updates."
              : "Ather uses notifications to alert you when your mining cycle completes, so you never miss a reward."}
          </Text>
        </View>

        <View style={styles.featureList}>
          {[
            { icon: "cpu",       text: "Mining completion alerts" },
            { icon: "gift",      text: "Reward claim reminders" },
            { icon: "shield",    text: "Security & account alerts" },
            { icon: "bell",      text: "Network & news updates" },
          ].map(({ icon, text }) => (
            <View key={icon} style={[styles.featureRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.featureIcon, { backgroundColor: colors.primaryPale }]}>
                <Feather name={icon as any} size={14} color={colors.primary} />
              </View>
              <Text style={[styles.featureText, { color: colors.foreground }]}>{text}</Text>
              <Feather name="check" size={14} color={colors.primary} />
            </View>
          ))}
        </View>

        <View style={styles.buttonGroup}>
          <Pressable onPress={handleAllow} style={({ pressed }) => [styles.allowBtn, { opacity: pressed ? 0.85 : 1 }]}>
            <LinearGradient
              colors={["#9fe870", "#7acc50"]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.allowGradient}
            >
              <Feather name={isDenied ? "settings" : "bell"} size={18} color="#0a1a00" />
              <Text style={styles.allowText}>
                {isDenied ? "Open Settings" : "Allow Notifications"}
              </Text>
            </LinearGradient>
          </Pressable>

          {isDenied && (
            <Pressable onPress={onRefresh} style={styles.retryLink}>
              <Text style={[styles.retryText, { color: colors.mutedForeground }]}>Tap here after enabling in settings</Text>
            </Pressable>
          )}
        </View>

        <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
          You can manage notification preferences at any time from Settings.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, justifyContent: "center" },
  inner: { flex: 1, paddingHorizontal: 28, justifyContent: "center", gap: 28 },

  topSection: { alignItems: "center", gap: 16 },
  iconRing:   { width: 100, height: 100, borderRadius: 50, borderWidth: 2, padding: 4 },
  iconGradient: { flex: 1, borderRadius: 46, alignItems: "center", justifyContent: "center" },
  badge:      { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9999, borderWidth: 1 },
  badgeText:  { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  textSection: { alignItems: "center", gap: 10 },
  heading:     { fontSize: 26, fontFamily: "Inter_700Bold", textAlign: "center" },
  sub:         { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, textAlign: "center" },

  featureList: { gap: 10 },
  featureRow:  { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  featureIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  featureText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },

  buttonGroup: { gap: 14 },
  allowBtn:    { borderRadius: 16, overflow: "hidden" },
  allowGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, paddingHorizontal: 24 },
  allowText:   { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0a1a00" },

  retryLink:   { alignItems: "center" },
  retryText:   { fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },

  footerNote:  { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center" },
});
