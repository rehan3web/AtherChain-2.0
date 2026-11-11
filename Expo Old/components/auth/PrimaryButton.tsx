import React from 'react';
import {
  TouchableOpacity,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

import { useColors } from '@/hooks/useColors';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function PrimaryButton({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: PrimaryButtonProps) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  if (variant === 'ghost') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        style={[styles.ghost, { opacity: isDisabled ? 0.5 : 1 }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.ghostText, { color: colors.primary }]}>{title}</Text>
      </TouchableOpacity>
    );
  }

  if (variant === 'secondary') {
    return (
      <TouchableOpacity
        onPress={onPress}
        disabled={isDisabled}
        activeOpacity={0.8}
        style={[
          styles.secondary,
          {
            backgroundColor: colors.secondary,
            borderRadius: colors.radius,
            borderColor: colors.border,
            opacity: isDisabled ? 0.5 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.foreground} />
        ) : (
          <Text style={[styles.secondaryText, { color: colors.secondaryForeground }]}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[styles.touchable, { opacity: isDisabled ? 0.6 : 1 }]}
    >
      <View
        style={[styles.gradient, { borderRadius: colors.radius, backgroundColor: colors.gradientStart }]}
      >
        {loading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>
            {title}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: { width: '100%' },
  gradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  secondary: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    width: '100%',
  },
  secondaryText: { fontSize: 16, fontWeight: '600' },
  ghost: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  ghostText: { fontSize: 15, fontWeight: '500' },
});
