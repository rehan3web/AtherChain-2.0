import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

/** Shape-led identity card with corner frame marks. */
export function IdentityIllustration({ icon = 'user', size = 1 }: { icon?: React.ComponentProps<typeof Feather>['name']; size?: number }) {
  const c = useColors();
  const W = 200 * size, H = 150 * size;
  const corner = (pos: object, rot: string) => (
    <View style={[st.corner, pos, { borderColor: c.walletMuted, transform: [{ rotate: rot }] }]} />
  );
  return (
    <View style={[st.wrap, { height: H + 50 * size }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <View style={{ width: W + 36, height: H + 36 }}>
        {corner({ top: 0, left: 0 }, '0deg')}
        {corner({ top: 0, right: 0 }, '90deg')}
        {corner({ bottom: 0, right: 0 }, '180deg')}
        {corner({ bottom: 0, left: 0 }, '270deg')}
        <View style={[st.card, { top: 18, left: 18, width: W, height: H, backgroundColor: c.walletField, transform: [{ rotate: '-4deg' }] }]}>
          <LinearGradient colors={['#FFB27A', '#F2667C', '#B66AD9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[st.avatar, { width: 64 * size, height: 64 * size, borderRadius: 32 * size }]}>
            <Feather name={icon} size={28 * size} color="#FFF8F2" />
          </LinearGradient>
          <View style={{ flex: 1, gap: 8 }}>
            <View style={[st.line, { width: '85%', backgroundColor: c.walletDisabled }]} />
            <View style={[st.line, { width: '60%', backgroundColor: c.walletDisabled }]} />
            <View style={[st.line, { width: '72%', backgroundColor: c.walletDisabled }]} />
          </View>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
  corner: { position: 'absolute', width: 22, height: 22, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  card: { position: 'absolute', borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  line: { height: 8, borderRadius: 4 },
});
