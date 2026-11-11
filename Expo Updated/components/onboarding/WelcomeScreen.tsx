import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { EASE_OUT, useReducedMotion } from '@/components/wallet/primitives';
import { IdentityIllustration } from '@/components/kyc/Illustration';
import { Heading, Notice, PrimaryButton } from '@/components/kyc/parts';
import { WRAP, useInsets } from './Shell';

export function WelcomeScreen() {
  const c = useColors();
  const { top, bottom } = useInsets();
  const reduce = useReducedMotion();
  const a = useRef([0, 1, 2].map(() => new Animated.Value(reduce ? 1 : 0))).current;
  useEffect(() => {
    if (reduce) { a.forEach(v => v.setValue(1)); return; }
    const anim = Animated.stagger(110, a.map(v => Animated.timing(v, { toValue: 1, duration: 420, easing: EASE_OUT, useNativeDriver: true })));
    anim.start();
    return () => anim.stop();
  }, [a, reduce]);
  const rise = (v: Animated.Value) => ({ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] });

  return (
    <View testID="welcome-screen" style={{ flex: 1, backgroundColor: c.miningPage ?? c.background, paddingTop: top }}>
      <View style={[WRAP, { flex: 1, justifyContent: 'center' }]}>
        <Animated.View style={rise(a[0])}><IdentityIllustration icon="shield" /></Animated.View>
        <Animated.View style={[rise(a[1]), { marginTop: 12 }]}>
          <Text style={{ fontFamily: 'DMSans_700Bold', fontSize: 15, letterSpacing: 2, color: c.walletSubtle, marginBottom: 10 }}>ATHERCHAIN</Text>
          <Heading title="Your keys, your practice ground" body="Walk through a wallet from first sign up to first transfer. Every account here is made up and stays on this screen." />
        </Animated.View>
      </View>
      <Animated.View style={[WRAP, rise(a[2]), { paddingBottom: bottom, gap: 10 }]}>
        <Notice text="Practice app. No real account, SMS or email is created." />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
          <View style={{ flex: 1 }}><PrimaryButton testID="welcome-login" variant="ghost" label="Login" onPress={() => router.push('/login')} /></View>
          <View style={{ flex: 1 }}><PrimaryButton testID="welcome-signup" label="Sign up" onPress={() => router.push('/signup')} /></View>
        </View>
      </Animated.View>
    </View>
  );
}
