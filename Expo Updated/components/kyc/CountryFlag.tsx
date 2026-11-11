import React from 'react';
import * as Flags from 'react-native-svg-circle-country-flags';
import { Feather } from '@expo/vector-icons';
import type { SvgProps } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';

export function CountryFlag({ code, size = 28 }: { code?: string; size?: number }) {
  const c = useColors();
  const key = code ? code[0].toUpperCase() + code.slice(1).toLowerCase() : '';
  const Flag = (Flags as unknown as Record<string, React.ComponentType<SvgProps>>)[key];
  return Flag ? <Flag width={size} height={size} /> : <Feather name="globe" size={size - 6} color={c.walletMuted} />;
}
