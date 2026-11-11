import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface PinVerificationStepProps {
  pin: string;
  pinError?: boolean;
  isBroadcasting: boolean;
  onKey: (k: string) => void;
  onDelete: () => void;
}

export const PinVerificationStep: React.FC<PinVerificationStepProps> = ({
  pin,
  pinError,
  isBroadcasting,
  onKey,
  onDelete,
}) => {
  const colors = useColors();
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pinError) {
      Animated.sequence([
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: -10, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnimation, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [pinError, shakeAnimation]);

  if (isBroadcasting) {
    return (
      <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 60 }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 24, fontSize: 18, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
          Broadcasting Transaction...
        </Text>
        <Text style={{ marginTop: 8, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" }}>
          Please wait while your transaction is confirmed on the blockchain.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ alignItems: "center" }}>
      <Text style={[styles.stepTitle, { color: pinError ? colors.negative : colors.foreground }]}>
        {pinError ? "Incorrect PIN" : "Enter 6-Digit PIN"}
      </Text>

      <Animated.View style={[styles.pinDotsRow, { transform: [{ translateX: shakeAnimation }] }]}>
        {[0, 1, 2, 3, 4, 5].map((i) => {
          let dotColor = colors.border;
          if (i < pin.length) {
            dotColor = pinError ? colors.negative : colors.primary;
          }
          return <View key={i} style={[styles.pinDot, { backgroundColor: dotColor }]} />;
        })}
      </Animated.View>

      <View style={styles.keypadContainer}>
        {[
          ["1", "2", "3"],
          ["4", "5", "6"],
          ["7", "8", "9"],
          ["", "0", "del"],
        ].map((row, rIdx) => (
          <View key={rIdx} style={styles.keypadRow}>
            {row.map((k, kIdx) => {
              if (!k) return <View key={kIdx} style={styles.keyItemEmpty} />;
              return (
                <Pressable
                  key={kIdx}
                  onPress={() => (k === "del" ? onDelete() : onKey(k))}
                  style={[styles.keyItem, { backgroundColor: colors.card }]}
                >
                  {k === "del" ? (
                    <Feather name="delete" size={22} color={colors.foreground} />
                  ) : (
                    <Text style={[styles.keyText, { color: colors.foreground }]}>{k}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stepTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", marginBottom: 20 },
  pinDotsRow: { flexDirection: "row", justifyContent: "center", gap: 16, marginVertical: 32 },
  pinDot: { width: 16, height: 16, borderRadius: 8 },
  keypadContainer: { width: "100%", maxWidth: 300, alignSelf: "center", marginTop: 20 },
  keypadRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", marginBottom: 14 },
  keyItem: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  keyItemEmpty: { width: 72, height: 72 },
  keyText: { fontSize: 26, fontFamily: "Inter_700Bold" },
});
