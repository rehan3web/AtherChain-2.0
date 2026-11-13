import React, { type ReactNode, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/toast/ToastContext';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { copyText } from '@/utils/clipboard';
import { useColors } from '@/hooks/useColors';
import type { Transaction } from './types';

export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => alive && setReduce(v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduce;
}

/* Pressable with a springy scale on press */
type ScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: ReactNode;
};
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ScalePressable({ style, scaleTo = 0.96, children, disabled, ...rest }: ScaleProps) {
  const s = useRef(new Animated.Value(1)).current;
  const to = (v: number) =>
    Animated.spring(s, { toValue: v, useNativeDriver: true, speed: 40, bounciness: 6 }).start();
  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      style={[style, { transform: [{ scale: s }] }]}
      onPressIn={(e) => {
        if (!disabled) to(scaleTo);
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        rest.onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

const isSrc = (s: string) => /^(https?:|file:|data:|content:|\/)/.test(s);

export function Face({ src, size }: { src: ReactNode; size: number }) {
  const c = useColors();
  if (typeof src === 'string') {
    if (isSrc(src)) {
      return <Image source={{ uri: src }} style={{ width: '100%', height: '100%' }} />;
    }
    return (
      <Text style={{ fontSize: size * 0.42, fontFamily: 'DMSans_600SemiBold', color: c.walletInk }}>
        {src}
      </Text>
    );
  }
  return <>{src}</>;
}

export function BallIcon({ size = 44 }: { size?: number }) {
  const c = useColors();
  return (
    <LinearGradient
      colors={c.walletBall}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: size * 0.8,
        height: size * 0.8,
        borderRadius: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name="basketball" size={size * 0.62} color="rgba(255,255,255,0.65)" />
    </LinearGradient>
  );
}

export function TxIcon({ tx, size }: { tx: Transaction; size: number }) {
  const c = useColors();
  return (
    <View
      style={[
        styles.txIcon,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: c.walletSurfaceTop },
      ]}
    >
      {tx.icon ? (
        <Face src={tx.icon} size={size} />
      ) : (
        <Feather name={tx.amount < 0 ? 'arrow-up' : 'arrow-down'} size={size * 0.45} color={c.walletSubtle} />
      )}
    </View>
  );
}

/* Counts the balance up/down to its new value */
export function AnimatedAmount({
  value,
  format,
  style,
}: {
  value: number;
  format: (v: number) => string;
  style?: StyleProp<import('react-native').TextStyle>;
}) {
  const reduce = useReducedMotion();
  const finite = Number.isFinite(value);
  const av = useRef(new Animated.Value(finite ? value : 0)).current;
  const wasFinite = useRef(finite);
  const [text, setText] = useState(() => finite ? format(value) : '—');
  const fmt = useRef(format);
  fmt.current = format;
  useEffect(() => {
    const id = av.addListener(({ value: v }) => setText(fmt.current(v)));
    return () => av.removeListener(id);
  }, [av]);
  useEffect(() => {
    if (!Number.isFinite(value)) {
      av.stopAnimation();
      wasFinite.current = false;
      setText('—');
      return;
    }
    if (reduce || !wasFinite.current) {
      wasFinite.current = true;
      av.setValue(value);
      setText(fmt.current(value));
      return;
    }
    const a = Animated.timing(av, { toValue: value, duration: 900, easing: EASE_OUT, useNativeDriver: false });
    a.start(({ finished }) => finished && setText(fmt.current(value)));
    return () => a.stop();
  }, [value, av, reduce]);
  return <Text style={style}>{finite ? text : '—'}</Text>;
}

export function Switch({
  checked,
  onChange,
  label,
  testID,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  testID?: string;
}) {
  const c = useColors();
  const x = useRef(new Animated.Value(checked ? 20 : 0)).current;
  useEffect(() => {
    Animated.spring(x, { toValue: checked ? 20 : 0, useNativeDriver: true, speed: 22, bounciness: 5 }).start();
  }, [checked, x]);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      testID={testID}
      hitSlop={8}
      onPress={() => onChange(!checked)}
      style={[styles.switch, { backgroundColor: checked ? c.walletInk : c.walletDisabled }]}
    >
      <Animated.View style={[styles.knob, { backgroundColor: c.walletSheet, transform: [{ translateX: x }] }]} />
    </Pressable>
  );
}

export function CopyLink({ link, testID, style }: { link: string; testID?: string; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (t.current) clearTimeout(t.current);
  }, []);
  const copy = async () => {
    try {
      await copyText(link);
      setFailed(false);
      setCopied(true);
      showToast({ kind: 'success', title: 'Payment link copied', body: 'Ready to paste.' });
    } catch {
      setFailed(true);
      showToast({ kind: 'error', title: 'Could not copy payment link', body: 'Please try again.' });
    }
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => {
      setCopied(false);
      setFailed(false);
    }, 1600);
  };
  return (
    <ScalePressable
      accessibilityRole="button"
      accessibilityLabel={`Copy payment link ${link}`}
      accessibilityHint="Copies the link to your clipboard"
      testID={testID}
      onPress={copy}
      scaleTo={0.97}
      style={[styles.copy, style]}
    >
      <Feather name={copied ? 'check' : 'copy'} size={16} color={c.walletSubtle} />
      <Text
        numberOfLines={1}
        accessibilityLiveRegion="polite"
        style={[styles.copyText, { color: c.walletSubtle }]}
      >
        {failed ? "Couldn't copy" : copied ? 'Link copied' : link}
      </Text>
    </ScalePressable>
  );
}

const styles = StyleSheet.create({
  txIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  switch: { width: 52, height: 32, borderRadius: 16, padding: 4 },
  knob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  copy: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 22,
    alignSelf: 'center',
    maxWidth: '100%',
  },
  copyText: { fontSize: 14, fontFamily: 'DMSans_500Medium', flexShrink: 1 },
});
