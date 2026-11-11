import React from 'react';
import { Image } from 'expo-image';
import { useTheme } from '@/hooks/useTheme';

export const ATHER_LOGO_ASPECT = 1024 / 898;
const logos = {
  black: require('../../assets/images/ather-logo-black.svg'),
  white: require('../../assets/images/ather-logo-white.svg'),
};

/** Ather mark: black in light mode, white in dark mode, transparent, aspect preserved inside a size box. */
export function AtherLogo({ size = 24, testID }: { size?: number; testID?: string }) {
  const { scheme } = useTheme();
  const fill = scheme === 'dark' ? 'white' : 'black';
  return (
    <Image
      testID={testID}
      accessibilityLabel={`Ather logo ${fill}`}
      source={logos[fill]}
      style={{ width: size, height: size / ATHER_LOGO_ASPECT }}
      contentFit="contain"
    />
  );
}
