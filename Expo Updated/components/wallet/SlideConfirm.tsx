import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, PanResponder, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useReducedMotion } from './primitives';
import { ConfirmedIcon } from './ConfirmedIcon';

/** Same handle travels, then unfurls leftward into the confirmed capsule. */
export function SlideConfirm({ onConfirm, operationLabel = 'demo swap', testID = 'wallet-swap-slider', status }: {
  onConfirm: () => void;
  operationLabel?: string;
  testID?: string;
  status?: 'idle' | 'pending' | 'confirmed';
}) {
  const c = useColors();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(280);
  const [done, setDone] = useState(false);
  const travel = Math.max(1, width - 56);
  const x = useRef(new Animated.Value(0)).current;
  const anchor = useRef(new Animated.Value(0)).current;
  const confirmed = useRef(false);
  const live = useRef({ travel, onConfirm, reduce });
  live.current = { travel, onConfirm, reduce };
  const commit = () => {
    if (confirmed.current) return;
    confirmed.current = true;
    const end = live.current.travel;
    Animated.timing(x, { toValue: end, duration: live.current.reduce ? 0 : 130, useNativeDriver: false }).start(({ finished }) => {
      if (!finished) return;
      anchor.setValue(end);
      setDone(true);
      Animated.spring(x, { toValue: 0, damping: 24, stiffness: 220, mass: 0.8, useNativeDriver: false }).start();
      live.current.onConfirm();
    });
  };
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !confirmed.current,
    onMoveShouldSetPanResponder: (_, g) => !confirmed.current && Math.abs(g.dx) > 3,
    onPanResponderGrant: () => x.stopAnimation(),
    onPanResponderMove: (_, g) => x.setValue(Math.max(0, Math.min(live.current.travel, g.dx))),
    onPanResponderRelease: (_, g) => {
      if (g.dx >= live.current.travel * 0.9) commit();
      else Animated.spring(x, { toValue: 0, useNativeDriver: false, damping: 20, stiffness: 230 }).start();
    },
    onPanResponderTerminate: () => {
      if (!confirmed.current) Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
    },
    onPanResponderTerminationRequest: () => false,
  })).current;
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[styles.track, { backgroundColor: c.walletFieldPressed }]} testID={testID}>
      <Animated.Text style={[styles.label, { color: c.walletSubtle, opacity: done ? 0 : x.interpolate({ inputRange: [0, travel * 0.55], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
        Slide to confirm
      </Animated.Text>
      <Animated.View
        {...pan.panHandlers}
        accessible accessibilityRole="adjustable"
        accessibilityLabel={done ? status === 'pending' ? `Sending ${operationLabel}` : `${operationLabel} confirmed` : `Slide to confirm ${operationLabel}`}
        accessibilityHint="Drag right to confirm, or use the confirm accessibility action."
        accessibilityValue={{ min: 0, max: 100, now: done ? 100 : 0 }}
        accessibilityActions={[{ name: 'activate', label: `Confirm ${operationLabel}` }, { name: 'increment', label: `Confirm ${operationLabel}` }]}
        onAccessibilityAction={commit}
        testID={`${testID}-handle`}
        style={[styles.grip, { backgroundColor: c.walletInk, left: Animated.add(4, x), width: Animated.add(48, Animated.subtract(anchor, done ? x : anchor)) }]}
      >
        {done ? status === 'pending' ? <ActivityIndicator size="small" color={c.walletOnInk} /> : <ConfirmedIcon size={20} /> : <Feather name="arrow-right" size={20} color={c.walletOnInk} />}
        {done && <Text style={[styles.done, { color: c.walletOnInk }]}>{status === 'pending' ? 'Sending…' : 'Confirmed'}</Text>}
      </Animated.View>
    </View>
  );
}
const styles = StyleSheet.create({
  track: { height: 56, width: '100%', borderRadius: 28, overflow: 'hidden' },
  label: { position: 'absolute', width: '100%', textAlign: 'center', lineHeight: 56, fontSize: 14, fontFamily: 'DMSans_500Medium' },
  grip: { position: 'absolute', top: 4, height: 48, borderRadius: 24, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  done: { fontSize: 14, fontFamily: 'DMSans_500Medium' },
});
