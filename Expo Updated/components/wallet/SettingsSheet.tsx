import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Switch } from './primitives';

export function SettingsSheet({
  hidden,
  onHiddenChange,
}: {
  hidden: boolean;
  onHiddenChange: (v: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.wrap}>
      <View style={[styles.row, { backgroundColor: c.walletField }]}>
        <View style={styles.flex}>
          <Text style={[styles.h, { color: c.walletInk }]}>Hide balance</Text>
          <Text style={[styles.p, { color: c.walletSubtle }]}>Mask your balance on the card</Text>
        </View>
        <Switch checked={hidden} onChange={onHiddenChange} label="Hide balance" testID="wallet-hide-balance-switch" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, paddingTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 16, padding: 16 },
  flex: { flex: 1 },
  h: { fontSize: 15, fontFamily: 'DMSans_500Medium' },
  p: { fontSize: 13, fontFamily: 'DMSans_400Regular', marginTop: 2 },
});
