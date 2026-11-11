import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
}

export default function Skeleton({ width, height, borderRadius = 12, style }: SkeletonProps) {
  const colors = useColors();
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animatedValue]);

  // Translate shimmer from left to right
  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 300],
  });

  return (
    <View
      style={[
        styles.container,
        {
          width: width as any,
          height: height as any,
          borderRadius,
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: 1,
        },
        style,
      ]}
    >
      <AnimatedLinearGradient
        colors={[
          "transparent",
          colors.primaryPale, // Light primary shimmer color
          "transparent",
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
});
