import React, { useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface SwipeButtonProps {
  title?: string;
  onConfirm: () => void;
  colors: any;
  height?: number;
  loading?: boolean;
}

export default function SwipeButton({
  title = "Swipe to Confirm",
  onConfirm,
  colors,
  height = 60,
  loading = false,
}: SwipeButtonProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  const containerWidthRef = useRef(0);
  const confirmedRef = useRef(false);
  const loadingRef = useRef(loading);

  loadingRef.current = loading;

  const thumbWidth = height;
  const maxDrag = containerWidth > 0 ? containerWidth - thumbWidth : 0;
  const pan = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !confirmedRef.current && !loadingRef.current,
      onStartShouldSetPanResponderCapture: () => !confirmedRef.current && !loadingRef.current,
      onMoveShouldSetPanResponder: () => !confirmedRef.current && !loadingRef.current,
      onMoveShouldSetPanResponderCapture: () => !confirmedRef.current && !loadingRef.current,
      onPanResponderGrant: () => {
        if (!confirmedRef.current && !loadingRef.current) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        const cw = containerWidthRef.current;
        if (confirmedRef.current || loadingRef.current || cw === 0) return;
        const localMaxDrag = cw - thumbWidth;
        let newVal = gestureState.dx;
        if (newVal < 0) newVal = 0;
        if (newVal > localMaxDrag) newVal = localMaxDrag;
        pan.setValue(newVal);
      },
      onPanResponderRelease: (_, gestureState) => {
        const cw = containerWidthRef.current;
        if (confirmedRef.current || loadingRef.current || cw === 0) return;
        const localMaxDrag = cw - thumbWidth;
        if (gestureState.dx > localMaxDrag * 0.75) {
          Animated.timing(pan, {
            toValue: localMaxDrag,
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            setConfirmed(true);
            confirmedRef.current = true;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onConfirm();
          });
        } else {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  return (
    <View
      style={[
        styles.container,
        {
          height,
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: loading ? 0.7 : 1,
        },
      ]}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        containerWidthRef.current = w;
        setContainerWidth(w);
      }}
    >
      <Text style={[styles.title, { color: colors.foreground }]}>{loading ? "Processing..." : title}</Text>
      {containerWidth > 0 && (
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: colors.primaryPale,
              width: Animated.add(pan, thumbWidth),
            },
          ]}
        />
      )}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.thumb,
          {
            width: thumbWidth,
            height: thumbWidth,
            backgroundColor: colors.primary,
            transform: [{ translateX: pan }],
          },
        ]}
      >
        <Feather name="chevrons-right" size={24} color={colors.primaryForeground} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    borderRadius: 9999,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    position: "absolute",
    zIndex: 1,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    zIndex: 0,
  },
  thumb: {
    position: "absolute",
    left: 0,
    borderRadius: 9999,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
});
