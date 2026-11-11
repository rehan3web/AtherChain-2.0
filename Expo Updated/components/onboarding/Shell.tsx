import React, { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { EASE_OUT, useReducedMotion } from '@/components/wallet/primitives';

export const WRAP = { paddingHorizontal: 24, maxWidth: 560, width: '100%' as const, alignSelf: 'center' as const };

export function useInsets() {
  const insets = useSafeAreaInsets();
  return {
    top: (Platform.OS === 'web' ? 67 : insets.top) + 8,
    bottom: Math.max(20, insets.bottom, Platform.OS === 'web' ? 34 : 0),
  };
}

/** Slides content in when `stepKey` changes; direction follows navigation. */
export function StepTransition({ stepKey, dir, children, testID }: { testID?: string; stepKey: string; dir: 1 | -1; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduce) { v.setValue(1); return; }
    v.setValue(0);
    const a = Animated.timing(v, { toValue: 1, duration: 280, easing: EASE_OUT, useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [stepKey, reduce, v]);
  return (
    <Animated.View testID={testID} style={{ flexGrow: 1, opacity: v, transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [28 * dir, 0] }) }] }}>
      {children}
    </Animated.View>
  );
}

export function Shell({ testID, backID, backLabel, onBack, footer, children, scroll = true }: {
  testID: string; backID: string; backLabel: string; onBack: () => void; footer?: React.ReactNode; children: React.ReactNode; scroll?: boolean;
}) {
  const c = useColors();
  const { top, bottom } = useInsets();
  return (
    <View testID={testID} style={{ flex: 1, backgroundColor: c.miningPage ?? c.background }}>
      <View style={{ paddingTop: top, paddingHorizontal: 12 }}>
        <Pressable testID={backID} onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel}
          style={({ pressed }) => [{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, pressed && { transform: [{ scale: 0.92 }] }]}>
          <Feather name="arrow-left" size={24} color={c.walletInk} />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            contentContainerStyle={[WRAP, { paddingTop: 8, paddingBottom: 24, flexGrow: 1 }]}>
            {children}
          </ScrollView>
        ) : <View style={[WRAP, { flex: 1, paddingTop: 8, paddingBottom: bottom }]}>{children}</View>}
        {!!footer && <View style={[WRAP, { paddingBottom: bottom, paddingTop: 8, gap: 10 }]}>{footer}</View>}
      </KeyboardAvoidingView>
    </View>
  );
}
