import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

/** Phone with authenticator code and shield badge, matching referral/KYC vector art. */
export function TwoFaIllustration({ completed = false }: { completed?: boolean }) {
  const c = useColors();
  const blue = c.walletBlue;
  const badgeFill = completed ? c.walletPositiveSoft : blue[0];
  const badgeStroke = completed ? c.walletPositive : blue[3];
  return (
    <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 12 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={176} height={136} viewBox="0 0 176 136">
        <Circle cx={88} cy={70} r={58} fill={c.walletInset} />
        <Rect x={58} y={18} width={60} height={104} rx={12} fill={c.walletSurfaceTop} stroke={c.walletInk} strokeWidth={2} />
        <Rect x={78} y={24} width={20} height={4} rx={2} fill={c.walletDisabled} />
        {[0, 1, 2].map(i => (
          <Rect key={`a${i}`} x={66 + i * 15} y={52} width={11} height={14} rx={3} fill={blue[3]} opacity={0.9} />
        ))}
        {[0, 1, 2].map(i => (
          <Rect key={`b${i}`} x={66 + i * 15} y={72} width={11} height={14} rx={3} fill={blue[1]} />
        ))}
        <Rect x={70} y={98} width={36} height={6} rx={3} fill={c.walletDisabled} />
        <Path d="M132 52 L150 58 V72 C150 84 142 92 132 96 C122 92 114 84 114 72 V58 Z"
          fill={badgeFill} stroke={badgeStroke} strokeWidth={2} strokeLinejoin="round" />
        {completed ? (
          <Path d="M125 73 L130 78 L139 67" fill="none" stroke={badgeStroke} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <>
            <Rect x={125} y={70} width={14} height={11} rx={2.5} fill={badgeStroke} />
            <Path d="M128 70 V66 C128 61 136 61 136 66 V70" fill="none" stroke={badgeStroke} strokeWidth={2} />
          </>
        )}
        <Circle cx={34} cy={40} r={12} fill={c.walletSurfaceTop} stroke={c.walletMuted} strokeWidth={2} />
        <Path d="M34 33 V40 L39 43" fill="none" stroke={c.walletMuted} strokeWidth={2} strokeLinecap="round" />
        <Circle cx={146} cy={28} r={4} fill={blue[2]} />
        <Circle cx={30} cy={98} r={3} fill={c.walletMuted} />
      </Svg>
    </View>
  );
}
