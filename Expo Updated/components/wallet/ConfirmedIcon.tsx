import React from 'react';
import { Image } from 'react-native';

// The supplied SVG is rasterized locally to avoid SVG data-URI decoding differences.
const BADGE = require('../../assets/images/confirmed-badge.png');

export function ConfirmedIcon({ size = 18 }: { size?: number }) {
  return (
    <Image
      source={BADGE}
      style={{ width: size, height: size, flexShrink: 0 }}
      resizeMode="contain"
      accessible={false}
    />
  );
}
