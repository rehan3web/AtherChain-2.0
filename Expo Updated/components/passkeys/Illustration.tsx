import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

/** Phone with key credential and fingerprint badge, matching 2FA/KYC vector art. */
export function PasskeyIllustration() {
  const c = useColors();
  const blue = c.walletBlue;
  return (
    <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 12 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={176} height={136} viewBox="0 0 176 136">
        <Circle cx={88} cy={70} r={58} fill={c.walletInset} />
        <Rect x={58} y={18} width={60} height={104} rx={12} fill={c.walletSurfaceTop} stroke={c.walletInk} strokeWidth={2} />
        <Rect x={78} y={24} width={20} height={4} rx={2} fill={c.walletDisabled} />
        <Circle cx={76} cy={66} r={10} fill="none" stroke={blue[3]} strokeWidth={3} />
        <Path d="M86 66 H104 M98 66 V73 M104 66 V71" fill="none" stroke={blue[3]} strokeWidth={3} strokeLinecap="round" />
        <Rect x={68} y={88} width={40} height={6} rx={3} fill={blue[1]} />
        <Rect x={74} y={100} width={28} height={6} rx={3} fill={c.walletDisabled} />
        <Circle cx={132} cy={74} r={20} fill={blue[0]} stroke={blue[3]} strokeWidth={2} />
        <Path d="M124 76 C124 70 128 66 132 66 C136 66 140 70 140 76" fill="none" stroke={blue[3]} strokeWidth={2} strokeLinecap="round" />
        <Path d="M128 82 C128 78 129 72 132 72 C135 72 136 76 136 80" fill="none" stroke={blue[3]} strokeWidth={2} strokeLinecap="round" />
        <Path d="M132 77 V84" fill="none" stroke={blue[3]} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={34} cy={40} r={12} fill={c.walletSurfaceTop} stroke={c.walletMuted} strokeWidth={2} />
        <Path d="M29 40 L33 44 L40 36" fill="none" stroke={c.walletMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={146} cy={28} r={4} fill={blue[2]} />
        <Circle cx={30} cy={98} r={3} fill={c.walletMuted} />
      </Svg>
    </View>
  );
}
