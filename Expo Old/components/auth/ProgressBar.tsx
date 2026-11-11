import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  const colors = useColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const fillWidth = useSharedValue(0);

  useEffect(() => {
    if (trackWidth > 0) {
      fillWidth.value = withTiming((currentStep / totalSteps) * trackWidth, {
        duration: 380,
      });
    }
  }, [currentStep, totalSteps, trackWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: fillWidth.value,
  }));

  return (
    <View
      style={[styles.track, { backgroundColor: colors.border }]}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        setTrackWidth(w);
        // Set initial width without animation
        fillWidth.value = (currentStep / totalSteps) * w;
      }}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: colors.primary, borderRadius: 4 },
          barStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 4,
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});
