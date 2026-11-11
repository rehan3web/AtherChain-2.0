import React, { createContext, useContext, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export type ToastType = "success" | "error" | "info" | "warning";

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

type IconName = "check-circle" | "alert-circle" | "alert-triangle" | "info";

const ICON_NAMES: Record<ToastType, IconName> = {
  success: "check-circle",
  error:   "alert-circle",
  warning: "alert-triangle",
  info:    "info",
};

const TITLES: Record<ToastType, string> = {
  success: "Success",
  error:   "Error",
  warning: "Warning",
  info:    "Info",
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function ToastUI({
  message,
  type,
  visible,
  fadeAnim,
  translateY,
  onDismiss,
}: {
  message: string;
  type: ToastType;
  visible: boolean;
  fadeAnim: Animated.Value;
  translateY: Animated.Value;
  onDismiss: () => void;
}) {
  const colors = useColors();

  const typeColors: Record<ToastType, string> = {
    success: colors.positive,
    error:   colors.negative,
    warning: colors.warning,
    info:    colors.primary,
  };

  const iconColor = typeColors[type];
  const iconBg    = hexToRgba(iconColor, 0.15);
  const iconName  = ICON_NAMES[type];

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View
        style={[
          styles.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
            backgroundColor: colors.card,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Feather name={iconName} size={24} color={iconColor} />
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {TITLES[type]}
          </Text>
          <Text style={[styles.msg, { color: colors.mutedForeground }]} numberOfLines={2}>
            {message}
          </Text>
        </View>
        <Pressable
          onPress={onDismiss}
          style={styles.closeBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="x" size={17} color={colors.mutedForeground} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("info");
  const [visible, setVisible] = useState(false);

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-140)).current;
  const timerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(fadeAnim,   { toValue: 0,    duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -140, duration: 220, useNativeDriver: true }),
    ]).start(() => setVisible(false));
  };

  const toast = (msg: string, t: ToastType = "info") => {
    if (timerRef.current) clearTimeout(timerRef.current);

    let clean = msg
      .replace(/^\d{3}\s*/, "")
      .replace(/[{}"[\]]/g, "")
      .replace(/^(error|message)[:\s]*/i, "")
      .replace(/^:\s*/, "")
      .trim();
    if (clean.length > 0) clean = clean.charAt(0).toUpperCase() + clean.slice(1);

    setMessage(clean || msg);
    setType(t);
    setVisible(true);
    translateY.setValue(-140);
    fadeAnim.setValue(0);

    const targetY = Platform.OS === "web"
      ? 16
      : (insets.top > 0 ? insets.top + 10 : 54);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(translateY, {
        toValue: targetY,
        friction: 7,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    timerRef.current = setTimeout(hide, 4200);
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <ToastUI
        message={message}
        type={type}
        visible={visible}
        fadeAnim={fadeAnim}
        translateY={translateY}
        onDismiss={hide}
      />
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-start",
    zIndex: 99999,
    elevation: 99999,
    pointerEvents: "box-none",
  } as any,
  container: {
    width: "92%",
    maxWidth: 430,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 24,
  },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
    flexShrink: 0,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  msg: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  closeBtn: {
    padding: 6,
    marginLeft: 8,
    flexShrink: 0,
  },
});
