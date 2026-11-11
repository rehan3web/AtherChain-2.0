import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { useReducedMotion } from '@/components/wallet/primitives';

export function ThemeSwitch() {
  const c = useColors();
  const { scheme, saving, toggleTheme } = useTheme();
  const dark = scheme === 'dark';
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(dark ? 28 : 0)).current;
  useEffect(() => {
    const animation = Animated.timing(x, { toValue: dark ? 28 : 0, duration: reduced ? 0 : 180, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [dark, reduced, x]);
  return (
    <Pressable
      testID="header-theme-switch"
      accessibilityRole="switch"
      accessibilityLabel="Dark mode"
      accessibilityHint={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      accessibilityState={{ checked: dark, disabled: saving }}
      aria-checked={dark}
      aria-disabled={saving}
      disabled={saving}
      onPress={() => { void toggleTheme(); }}
      style={styles.touch}
    >
      <View style={[styles.track, { backgroundColor: c.walletField, borderColor: c.walletDisabled }]}>
        <Animated.View style={[styles.thumb, { backgroundColor: dark ? c.walletFieldPressed : c.walletSurfaceTop, transform: [{ translateX: x }] }]} />
        <View style={styles.icon}><Feather name="sun" size={15} color={dark ? c.walletSubtle : c.walletInk} /></View>
        <View style={styles.icon}><Feather name="moon" size={15} color={dark ? c.walletInk : c.walletSubtle} /></View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touch: { width: 64, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  track: { width: 64, height: 36, borderWidth: 1, padding: 3, borderRadius: 18, flexDirection: 'row', alignItems: 'center' },
  thumb: { position: 'absolute', left: 3, top: 3, width: 28, height: 28, borderRadius: 14 },
  icon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
});
