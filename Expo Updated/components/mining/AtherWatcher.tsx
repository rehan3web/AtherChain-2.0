import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { useColors } from '@/hooks/useColors';

// Adapted from the supplied Watcher: Cube body, Slant eyes, spherical projection.
const SIZE = 180;
const LINES = [
  'Hi,\nI am AtherChain.',
  'Your AtherChain\nmining companion.',
  'Tap Claim when your\nmining session is ready.',
];
const SPRING = { stiffness: 150, damping: 18, mass: 0.8 };

function WatcherEye({ side, x, y, lid, color }: {
  side: -1 | 1;
  x: SharedValue<number>;
  y: SharedValue<number>;
  lid: SharedValue<number>;
  color: string;
}) {
  const animated = useAnimatedStyle(() => {
    const yaw = Math.asin(Math.min(.92, Math.max(-.92, x.value)));
    const pitch = -Math.asin(Math.min(.92, Math.max(-.92, y.value)));
    const x0 = side * .19;
    const z0 = Math.sqrt(1 - x0 * x0);
    const x1 = x0 * Math.cos(yaw) + z0 * Math.sin(yaw);
    const z1 = -x0 * Math.sin(yaw) + z0 * Math.cos(yaw);
    const y2 = -z1 * Math.sin(pitch);
    const z2 = z1 * Math.cos(pitch);
    const near = Math.max(0, Math.min(1, z2));
    const k = .45 + .55 * near;
    const scale = SIZE / 100;
    const w = 9 * k * (.7 + .3 * near) * scale;
    const h = Math.max(.6, 15 * k * lid.value) * scale;
    return {
      left: (44 + x1 * 50) * scale - w / 2,
      top: (44 + y2 * 50) * scale - h / 2,
      width: w,
      height: h,
      borderRadius: Math.min(4.5 * scale, w / 2, h / 2),
      opacity: z2 < .05 ? 0 : 1,
      transform: [{ rotate: `${64 * x.value * y.value}deg` }],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.eye, { backgroundColor: color }, animated]} />;
}

export function AtherWatcher() {
  const c = useColors();
  const frame = useRef<React.ComponentRef<typeof View>>(null);
  const center = useRef({ x: 0, y: 0 });
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const lid = useSharedValue(1);
  const scale = useSharedValue(1);
  const [reduced, setReduced] = useState(false);
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [speech, setSpeech] = useState(0);
  const [typed, setTyped] = useState('');
  const [talking, setTalking] = useState(false);
  const active = focused && appActive;
  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useFocusEffect(useCallback(() => {
    setFocused(true);
    return () => setFocused(false);
  }, []));
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(v => { if (mounted) setReduced(v); }).catch(() => {});
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => { mounted = false; motion.remove(); app.remove(); };
  }, []);

  const measure = useCallback(() => {
    frame.current?.measureInWindow((left, top, width, height) => {
      center.current = { x: left + width / 2, y: top + height / 2 };
    });
  }, []);
  const aim = useCallback((dx: number, dy: number) => {
    const distance = Math.hypot(dx, dy) || 1;
    const far = Math.min(.85, Math.tanh(distance / 90) * .9);
    const tx = dx / distance * far;
    const ty = dy / distance * far;
    x.value = reduced ? tx : withSpring(tx, SPRING);
    y.value = reduced ? ty : withSpring(ty, SPRING);
  }, [reduced, x, y]);
  const rest = useCallback(() => {
    x.value = reduced ? 0 : withSpring(0, SPRING);
    y.value = reduced ? 0 : withSpring(0, SPRING);
  }, [reduced, x, y]);

  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(x); cancelAnimation(y); cancelAnimation(lid); cancelAnimation(scale);
      lid.value = 1; scale.value = 1;
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const blink = () => {
      lid.value = withSequence(withTiming(.1, { duration: 80 }), withTiming(1, { duration: 80 }));
      timer = setTimeout(blink, 2600 + Math.random() * 3200);
    };
    timer = setTimeout(blink, 2200);
    return () => { clearTimeout(timer); cancelAnimation(lid); };
  }, [active, reduced, x, y, lid, scale]);

  useEffect(() => {
    if (!active) return;
    measure();
    if (Platform.OS === 'web') {
      const move = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' || event.pointerType === 'pen') {
          aim(event.clientX - center.current.x, event.clientY - center.current.y);
        }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('resize', measure);
      window.addEventListener('scroll', measure, true);
      document.documentElement.addEventListener('pointerleave', rest);
      return () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('resize', measure);
        window.removeEventListener('scroll', measure, true);
        document.documentElement.removeEventListener('pointerleave', rest);
        cancelAnimation(x); cancelAnimation(y);
      };
    }
    if (reduced) return;
    let reset: ReturnType<typeof setTimeout> | undefined;
    const glance = setInterval(() => {
      aim((Math.random() - .5) * 160, (Math.random() - .5) * 100);
      reset = setTimeout(rest, 1000);
    }, 5000);
    return () => { clearInterval(glance); clearTimeout(reset); cancelAnimation(x); cancelAnimation(y); };
  }, [active, reduced, aim, rest, measure, x, y]);

  useEffect(() => {
    if (!speech || !active) { setTalking(false); return; }
    const line = LINES[(speech - 1) % LINES.length];
    let timer: ReturnType<typeof setTimeout>;
    let index = reduced ? line.length : 0;
    setTyped(line.slice(0, index));
    setTalking(true);
    const type = () => {
      if (index < line.length) {
        index++;
        setTyped(line.slice(0, index));
        timer = setTimeout(type, 38);
      } else timer = setTimeout(() => setTalking(false), 2400);
    };
    timer = setTimeout(type, reduced ? 0 : 38);
    return () => clearTimeout(timer);
  }, [speech, active, reduced]);

  const poke = () => {
    if (!active) return;
    if (!reduced) scale.value = withSequence(withTiming(.96, { duration: 100 }), withSpring(1, SPRING));
    setSpeech(value => value + 1);
  };

  return (
    <View ref={frame} onLayout={measure} style={styles.frame}>
      <Pressable
        testID="mining-ather-watcher"
        accessibilityRole="button"
        accessibilityLabel="AtherChain companion"
        accessibilityHint="Tap to hear a greeting from AtherChain"
        onPress={poke}
        onTouchMove={event => aim(event.nativeEvent.pageX - center.current.x, event.nativeEvent.pageY - center.current.y)}
        onTouchEnd={rest}
        style={styles.target}
      >
        <Animated.View style={[styles.body, { backgroundColor: c.walletSurfaceTop }, bodyStyle]}>
          <WatcherEye side={-1} x={x} y={y} lid={lid} color={c.walletInk} />
          <WatcherEye side={1} x={x} y={y} lid={lid} color={c.walletInk} />
        </Animated.View>
      </Pressable>
      {talking && (
        <View pointerEvents="none" testID="mining-watcher-message" accessibilityLiveRegion="polite" style={[styles.bubble, { backgroundColor: c.walletPositive }]}>
          <Text style={[styles.message, { color: c.walletOnInk }]}>{typed}<Text>▏</Text></Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 250, height: 258, alignItems: 'center', justifyContent: 'center' },
  target: { width: SIZE, height: SIZE },
  body: { position: 'absolute', left: SIZE * .06, right: SIZE * .06, top: SIZE * .06, bottom: SIZE * .06, borderRadius: SIZE * .24, overflow: 'hidden' },
  eye: { position: 'absolute' },
  bubble: { position: 'absolute', right: 0, bottom: 34, width: 230, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10, borderTopLeftRadius: 6, borderTopRightRadius: 14, borderBottomLeftRadius: 14, borderBottomRightRadius: 14, zIndex: 2 },
  message: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 18 },
});
