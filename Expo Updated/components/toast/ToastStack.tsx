import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeOutRight, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from '@/components/wallet/primitives';
import { ConfirmedIcon } from '@/components/wallet/ConfirmedIcon';
import type { ToastItem } from './toast-model';

const SPRING = { stiffness: 380, damping: 34, mass: 1 };

/** Shared reference-style paper stack. Only the active window renders it. */
export function ToastStack({ toasts, onDismiss, onPauseChange, modal = false }: {
  toasts: ToastItem[]; onDismiss: (id: number) => void; onPauseChange: (paused: boolean) => void; modal?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);
  const open = expanded || hovered;
  useEffect(() => {
    onPauseChange(open);
    return () => onPauseChange(false);
  }, [open, onPauseChange]);
  return (
    <View testID="global-toast-anchor" pointerEvents="box-none" style={[styles.anchor, { top: (Platform.OS === 'web' ? 67 : modal ? Math.max(insets.top, 48) : insets.top) + (modal ? 24 : 12) }]}>
      <View testID="global-toast-stack" pointerEvents="box-none"
        onPointerEnter={event => { if (event.nativeEvent.pointerType === 'mouse') setHovered(true); }}
        onPointerLeave={event => { if (event.nativeEvent.pointerType === 'mouse') setHovered(false); }}
        style={{ width: '100%', maxWidth: 340, height: open ? toasts.length * 74 - 10 : 64 + (toasts.length - 1) * 14 }}>
        {toasts.map((toast, index) => (
          <ToastCard key={toast.id} toast={toast} index={index} count={toasts.length} open={open} onDismiss={onDismiss} onToggle={() => setExpanded(value => !value)} />
        ))}
      </View>
    </View>
  );
}

function ToastCard({ toast, index, count, open, onDismiss, onToggle }: {
  toast: ToastItem; index: number; count: number; open: boolean;
  onDismiss: (id: number) => void; onToggle: () => void;
}) {
  const c = useColors();
  const reduced = useReducedMotion();
  const front = index === 0;
  const visible = open || front;
  const targetY = (count - 1 - index) * (open ? 74 : 14);
  const targetScale = open ? 1 : 1 - index * .05;
  const position = useAnimatedStyle(() => ({
    transform: [
      { translateY: reduced ? targetY : withSpring(targetY, SPRING) },
      { scale: reduced ? targetScale : withSpring(targetScale, SPRING) },
    ],
  }));
  return (
    <Animated.View testID={`toast-${toast.kind}-${toast.id}`} pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible} importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      style={[styles.slot, { zIndex: count - index }, position]}>
      <Animated.View entering={reduced ? undefined : FadeInDown.duration(180)} exiting={reduced ? undefined : FadeOutRight.duration(180)}
        style={[styles.card, { backgroundColor: front || open ? c.walletSurfaceTop : c.walletField, borderColor: c.miningHairline }]}>
        <Pressable onPress={onToggle} accessibilityRole="button" accessibilityLabel={[toast.title, toast.body].filter(Boolean).join('. ')}
          accessibilityHint="Tap to expand or collapse notifications" style={[styles.content, { opacity: visible ? 1 : 0 }]}>
          {toast.kind === 'success' ? <ConfirmedIcon size={18} /> : <Feather name={toast.kind === 'error' ? 'x-circle' : 'info'} size={18} color={toast.kind === 'error' ? c.walletError : c.walletSubtle} />}
          <View style={styles.text}>
            <Text numberOfLines={1} style={[styles.title, { color: c.walletInk }]}>{toast.title}</Text>
            {!!toast.body && <Text numberOfLines={1} style={[styles.body, { color: c.walletSubtle }]}>{toast.body}</Text>}
          </View>
        </Pressable>
        <Pressable onPress={() => onDismiss(toast.id)} accessibilityRole="button" accessibilityLabel={`Dismiss ${toast.title}`} style={[styles.close, { opacity: visible ? 1 : 0 }]}>
          <Feather name="x" size={16} color={c.walletSubtle} />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, alignItems: 'center', zIndex: 100, elevation: 20 },
  slot: { position: 'absolute', top: 0, left: 0, right: 0, height: 64 },
  card: { height: 64, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 4 },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0, height: '100%' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: 'DMSans_500Medium', fontSize: 14, lineHeight: 18, letterSpacing: -.14 },
  body: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 17 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
