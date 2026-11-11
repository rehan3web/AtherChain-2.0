import { Feather } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, ScrollView, Image, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import { swapApi, extractError } from "@/services/api";
import { useToast } from "@/contexts/ToastContext";
import SwipeButton from "@/components/SwipeButton";

export default function ReviewSwapScreen() {
  const colors = useColors();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { toast } = useToast();

  const { amount = "0", swapRate = "1" } = params;
  const numAmount = parseFloat(String(amount));
  const numRate = parseFloat(String(swapRate));
  const receivedAmount = (numAmount * numRate).toFixed(4);

  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await swapApi.execute(numAmount);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(`${numAmount} AT → ${receivedAmount} ATH swapped successfully!`, "success");
      // Go back to the swap screen, or wherever you want
      router.replace("/(tabs)/swap");
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      toast(extractError(err), "error");
      setSubmitting(false);
    }
  };

  const summaryItems = [
    { label: "You Send", value: `${numAmount} AT` },
    { label: "Exchange Rate", value: `1 AT ≈ ${numRate} ATH` },
    { label: "Network Fee", value: "0 ATH" },
    { label: "You Receive", value: `${receivedAmount} ATH` },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.root, { backgroundColor: colors.background }]}>
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
              Review Transfer
            </Text>
          </View>
          
          <View style={styles.iconContainer}>
            {/* Base Circle (AT) */}
            <View style={[styles.circleBase, { backgroundColor: colors.card, borderColor: colors.border, overflow: "hidden" }]}>
              <Image 
                source={require("../assets/images/AT.png")} 
                style={{ width: "100%", height: "100%" }} 
                resizeMode="cover"
              />
            </View>
            
            {/* Overlapping Circle (ATH / Link) */}
            <View style={[styles.circleOverlap, { backgroundColor: theme === 'dark' ? '#ffffff' : '#000000', borderColor: colors.background, overflow: "hidden" }]}>
              <Image 
                source={require("../assets/images/link.png")} 
                style={{ width: 28, height: 28 }} 
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        <View style={[styles.separator, { backgroundColor: colors.border }]} />

        <View style={styles.summarySection}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            Summary
          </Text>
          <View style={styles.summaryList}>
            {summaryItems.map((item) => (
              <View key={item.label} style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>
                  {item.label}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.foreground }]} numberOfLines={1} ellipsizeMode="middle">
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Footer Area for the Swipe Button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 20, 40) }]}>
        <SwipeButton 
          title="Swipe to Confirm" 
          onConfirm={handleConfirm} 
          colors={colors} 
          loading={submitting} 
        />
      </View>
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },
  header: { alignItems: "flex-start", marginBottom: 40 },
  backBtn: { padding: 4, marginLeft: -4 },
  
  topSection: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  titleArea: { flex: 1, paddingRight: 16 },
  pageTitle: { fontSize: 32, fontFamily: "Inter_700Bold", lineHeight: 38 },
  
  iconContainer: { position: "relative", width: 74, height: 44, flexShrink: 0 },
  circleBase: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", position: "absolute", top: 0, left: 0, zIndex: 1 },
  circleOverlap: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: "center", justifyContent: "center", position: "absolute", top: 0, right: 0, zIndex: 2 },
  
  separator: { height: 1, marginTop: 40, marginBottom: 32 },
  
  summarySection: { marginTop: 8 },
  summaryTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 24, lineHeight: 16 },
  summaryList: { gap: 48 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  summaryLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 14 },
  summaryValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", lineHeight: 14, textAlign: "right", flex: 1, marginLeft: 16 },

  footer: {
    paddingHorizontal: 20,
    width: "100%",
  }
});
