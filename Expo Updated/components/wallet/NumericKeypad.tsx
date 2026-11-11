import React from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { BACKSPACE } from './format';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', BACKSPACE];
const ROWS = [0, 3, 6, 9].map(i => KEYS.slice(i, i + 3));

/** Wallet numeric keypad. `hideDecimal` keeps the grid but renders an inert spacer in place of the dot. */
export function NumericKeypad({ onKey, onClear, disabled, decimal = '.', hideDecimal, testIDPrefix = 'wallet-key' }: {
  onKey: (k: string) => void; onClear?: () => void; disabled?: boolean; decimal?: string; hideDecimal?: boolean; testIDPrefix?: string;
}) {
  const c = useColors();
  return (
    <View style={styles.pad} testID={`${testIDPrefix}pad`}>
      {ROWS.map((row, r) => (
      <View key={r} style={styles.row}>
      {row.map((k) => (k === '.' && hideDecimal) ? (
        <View key={k} style={[styles.key, { backgroundColor: 'transparent' }]} importantForAccessibility="no" accessibilityElementsHidden />
      ) : (
        <Pressable
          key={k}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={k === BACKSPACE ? 'Delete' : k === '.' ? 'Decimal point' : k}
          accessibilityState={{ disabled: !!disabled }}
          testID={`${testIDPrefix}-${k === '.' ? 'dot' : k === BACKSPACE ? BACKSPACE : k}`}
          onPress={() => { Keyboard.dismiss(); onKey(k); }}
          onLongPress={k === BACKSPACE && onClear ? onClear : undefined}
          style={({ pressed }) => [
            styles.key,
            { backgroundColor: pressed ? c.walletFieldPressed : c.walletField },
            pressed && { transform: [{ scale: 0.95 }] },
          ]}
        >
          {k === BACKSPACE ? (
            <Feather name="delete" size={22} color={c.walletInk} />
          ) : (
            <Text style={[styles.keyText, { color: c.walletInk }]}>{k === '.' ? decimal : k}</Text>
          )}
        </Pressable>
      ))}
      </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  key: { flex: 1, minWidth: 0, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 22, fontFamily: 'DMSans_500Medium', fontVariant: ['tabular-nums'] },
});
