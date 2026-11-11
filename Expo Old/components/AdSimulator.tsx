import React, { useState, useEffect } from "react";
import { Modal, View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

interface AdSimulatorProps {
  visible: boolean;
  onClose: () => void;
  onReward: () => void;
}

export default function AdSimulator({ visible, onClose, onReward }: AdSimulatorProps) {
  const [timeLeft, setTimeLeft] = useState(5);
  const [rewardGranted, setRewardGranted] = useState(false);
  const colors = useColors();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (visible) {
      setTimeLeft(5);
      setRewardGranted(false);

      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setRewardGranted(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [visible]);

  const handleClose = () => {
    if (rewardGranted) {
      onReward();
    }
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={() => { if(rewardGranted) handleClose(); }}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          {rewardGranted ? (
            <Pressable onPress={handleClose} style={styles.closeBtn}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          ) : (
            <View style={styles.timerBadge}>
              <Text style={styles.timerText}>Reward in {timeLeft}s</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Feather name="video" size={64} color={colors.primary} style={{ opacity: 0.5, marginBottom: 24 }} />
          <Text style={[styles.title, { color: colors.foreground }]}>Advertisement</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            This is a simulated video ad. {"\n"}Please wait for it to finish to claim your reward.
          </Text>
          
          {!rewardGranted && (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          )}

          {rewardGranted && (
            <View style={[styles.rewardBox, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
              <Feather name="check-circle" size={32} color={colors.primary} style={{ marginBottom: 12 }} />
              <Text style={[styles.rewardTitle, { color: colors.primary }]}>Reward Granted!</Text>
              <Text style={[styles.rewardDesc, { color: colors.foreground }]}>You can now close this ad.</Text>
            </View>
          )}
        </View>

        {!rewardGranted && (
          <Pressable onPress={onClose} style={styles.footerBtn}>
            <Text style={[styles.footerBtnText, { color: colors.mutedForeground }]}>Close Video (Lose Reward)</Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 16,
    height: 60,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: "rgba(150, 150, 150, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(150, 150, 150, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  timerText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    color: "#fff",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  rewardBox: {
    marginTop: 40,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    width: "100%",
  },
  rewardTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    marginBottom: 8,
  },
  rewardDesc: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  footerBtn: {
    padding: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  footerBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
