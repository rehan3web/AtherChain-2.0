import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { EASE_OUT, useReducedMotion } from '@/components/wallet/primitives';
import { CODE_LENGTH } from './demo';

export type Phase = 'entry' | 'error' | 'success';
const SIZE = 18;
const GAP = 16;
const BIG = 76;
const TICK_LEN = 48;
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Six progress circles. Calls onFinished only when an animation completes uninterrupted. */
export function CodeCircles({ filled, phase, onFinished }: { filled: number; phase: Phase; onFinished: () => void }) {
  const c = useColors();
  const reduce = useReducedMotion();
  const shake = useRef(new Animated.Value(0)).current;
  const merge = useRef(new Animated.Value(0)).current;
  const big = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(TICK_LEN)).current;
  const done = useRef(onFinished);
  done.current = onFinished;

  useEffect(() => {
    shake.setValue(0); merge.setValue(0); big.setValue(0); tick.setValue(TICK_LEN);
    if (phase === 'entry') return;
    let anim: Animated.CompositeAnimation;
    if (phase === 'error') {
      const step = (v: number) => Animated.timing(shake, { toValue: v, duration: 55, easing: Easing.linear, useNativeDriver: true });
      anim = Animated.sequence([step(12), step(-12), step(9), step(-9), step(5), step(0), Animated.delay(reduce ? 500 : 320)]);
    } else {
      anim = reduce
        ? Animated.sequence([
            Animated.parallel([Animated.timing(merge, { toValue: 1, duration: 0, useNativeDriver: true }), Animated.timing(big, { toValue: 1, duration: 0, useNativeDriver: true })]),
            Animated.timing(tick, { toValue: 0, duration: 0, useNativeDriver: false }),
            Animated.delay(900),
          ])
        : Animated.sequence([
            Animated.delay(180),
            Animated.timing(merge, { toValue: 1, duration: 380, easing: EASE_OUT, useNativeDriver: true }),
            Animated.spring(big, { toValue: 1, useNativeDriver: true, speed: 16, bounciness: 8 }),
            Animated.timing(tick, { toValue: 0, duration: 360, easing: EASE_OUT, useNativeDriver: false }),
            Animated.delay(700),
          ]);
    }
    anim.start(({ finished }) => { if (finished) done.current(); });
    return () => anim.stop();
  }, [phase, reduce, shake, merge, big, tick]);

  const color = phase === 'error' ? c.walletError : phase === 'success' ? c.walletPositive : c.walletInk;
  const status = phase === 'error' ? 'Code rejected' : phase === 'success' ? 'Code accepted' : `${filled} of ${CODE_LENGTH} digits entered`;
  const width = CODE_LENGTH * SIZE + (CODE_LENGTH - 1) * GAP;

  return (
    <View style={{ height: BIG + 8, alignItems: 'center', justifyContent: 'center' }}>
      <Text testID="twofa-anim-status" accessibilityLiveRegion="polite" accessibilityLabel={status}
        style={{ position: 'absolute', opacity: 0, fontSize: 1 }}>{phase}</Text>
      <Animated.View testID="twofa-circles" accessible accessibilityLabel={status}
        style={{ width, height: SIZE, flexDirection: 'row', gap: GAP, transform: [{ translateX: shake }] }}>
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const offset = (CODE_LENGTH - 1) / 2 * (SIZE + GAP) - i * (SIZE + GAP);
          const on = i < filled;
          return (
            <Animated.View key={i} testID={`twofa-circle-${i}`}
              style={{
                width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 2, borderColor: on ? color : c.walletDisabled,
                backgroundColor: on ? color : 'transparent',
                opacity: merge.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                transform: [{ translateX: merge.interpolate({ inputRange: [0, 1], outputRange: [0, offset] }) }],
              }} />
          );
        })}
      </Animated.View>
      {phase === 'success' && (
        <Animated.View testID="twofa-success-circle"
          style={{ position: 'absolute', width: BIG, height: BIG, borderRadius: BIG / 2, backgroundColor: c.walletPositive, alignItems: 'center', justifyContent: 'center',
            opacity: big.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale: big.interpolate({ inputRange: [0, 1], outputRange: [SIZE / BIG, 1] }) }] }}>
          <Svg width={40} height={40} viewBox="0 0 40 40">
            <AnimatedPath d="M9 21 L17 29 L31 12" stroke="#ffffff" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" fill="none"
              strokeDasharray={TICK_LEN} strokeDashoffset={tick} />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}
