import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface PasswordStrengthMeterProps {
  password: string;
}

function getStrength(password: string): { score: number; label: string } {
  if (!password) return { score: 0, label: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  const labels = ['Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score - 1] ?? 'Weak' };
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const colors = useColors();
  const { score, label } = useMemo(() => getStrength(password), [password]);

  if (!password) return null;

  const segmentColors = [
    colors.destructive,
    colors.warning,
    colors.positive,
    colors.positive,
  ];
  const activeColor = segmentColors[score - 1] ?? colors.destructive;

  return (
    <View style={styles.wrapper}>
      <View style={styles.bars}>
        {[1, 2, 3, 4].map(i => (
          <View
            key={i}
            style={[
              styles.bar,
              {
                backgroundColor: i <= score ? activeColor : colors.border,
                borderRadius: 3,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: activeColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  bars: { flexDirection: 'row', gap: 4, flex: 1 },
  bar: { flex: 1, height: 4 },
  label: { fontSize: 12, fontWeight: '600', width: 48, textAlign: 'right' },
});
