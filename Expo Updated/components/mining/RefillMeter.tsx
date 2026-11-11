import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Image, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/components/wallet/primitives';

const WATER_HEIGHT = 82;
const WAVE = require('../../assets/images/refill-wave.png');

/** Visualizes the existing saved mining cycle; never runs its own claim timer. */
export function RefillMeter({ progress, orientation = 'vertical', testID = 'mining-refill-meter' }: {
  progress: number | null;
  orientation?: 'vertical' | 'horizontal';
  testID?: string;
}) {
  const c = useColors();
  const horizontal = orientation === 'horizontal';
  const [waterWidth, setWaterWidth] = useState(0);
  const reduced = useReducedMotion();
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const value = Math.max(0, Math.min(1, progress ?? 0));
  const level = useSharedValue(value);
  const phase = useSharedValue(0);
  const moving = focused && appActive && !reduced && value > 0 && value < 1;
  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);
  useEffect(() => {
    // A successful claim resets instantly; ordinary timer ticks rise smoothly.
    level.value = value === 0 || value === 1 || value < level.value || reduced || !focused || !appActive
      ? value : withTiming(value, { duration: 1000, easing: Easing.linear });
    return () => cancelAnimation(level);
  }, [value, reduced, focused, appActive, level]);
  useEffect(() => {
    if (moving) phase.value = withRepeat(withTiming(36, { duration: 1800, easing: Easing.linear }), -1, false);
    else { cancelAnimation(phase); phase.value = 0; }
    return () => cancelAnimation(phase);
  }, [moving, phase]);
  const waterStyle = useAnimatedStyle(() => horizontal
    ? { width: level.value * waterWidth, opacity: level.value > 0 ? 1 : 0 }
    : { height: level.value * WATER_HEIGHT, opacity: level.value > 0 ? 1 : 0 });
  const frontWave = useAnimatedStyle(() => ({ transform: horizontal ? [{ translateY: -phase.value }] : [{ translateX: -phase.value }] }));
  const backWave = useAnimatedStyle(() => ({ transform: horizontal ? [{ translateY: phase.value - 36 }] : [{ translateX: phase.value - 36 }] }));
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Mining session refill"
      accessibilityValue={progress === null
        ? { min: 0, max: 100, text: 'Loading mining progress' }
        : { min: 0, max: 100, now: Math.round(value * 100), text: value === 1 ? 'Full. Ready to claim.' : `${Math.round(value * 100)} percent refilled` }}
      style={[horizontal ? styles.horizontalTrack : styles.track, { borderColor: c.miningHairline, backgroundColor: c.walletSurfaceTop }]}
    >
      <View
        onLayout={horizontal ? event => setWaterWidth(event.nativeEvent.layout.width) : undefined}
        style={[styles.window, { backgroundColor: c.walletDisabled }]}
      >
        <Animated.View style={[horizontal ? styles.horizontalWater : styles.water, { backgroundColor: c.walletPositive }, waterStyle]}>
          {value > 0 && value < 1 && (
            <>
              <Animated.View style={[horizontal ? styles.horizontalWave : styles.wave, horizontal ? styles.horizontalBackWave : styles.backWave, backWave]}>
                <Image source={WAVE} resizeMode="stretch" style={[horizontal ? styles.horizontalWaveImage : styles.waveImage, { tintColor: c.walletPositive }]} />
              </Animated.View>
              <Animated.View style={[horizontal ? styles.horizontalWave : styles.wave, frontWave]}>
                <Image source={WAVE} resizeMode="stretch" style={[horizontal ? styles.horizontalWaveImage : styles.waveImage, { tintColor: c.walletPositive }]} />
              </Animated.View>
            </>
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: 30, height: 94, padding: 5, borderWidth: 1, borderRadius: 10 },
  horizontalTrack: { width: '100%', height: 30, padding: 5, borderWidth: 1, borderRadius: 10 },
  window: { flex: 1, borderRadius: 4, overflow: 'hidden' },
  water: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  horizontalWater: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  wave: { position: 'absolute', left: -18, top: -6, width: 72, height: 12 },
  backWave: { top: -8, opacity: .35 },
  waveImage: { width: 72, height: 12 },
  horizontalWave: { position: 'absolute', right: -6, top: -18, width: 12, height: 72 },
  horizontalBackWave: { right: -8, opacity: .35 },
  horizontalWaveImage: { position: 'absolute', left: -30, top: 30, width: 72, height: 12, transform: [{ rotate: '90deg' }] },
});
