import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { copyText } from '@/utils/clipboard';
import { toQR } from 'toqr';
import { useColors } from '@/hooks/useColors';
import type { RecipientMethod } from './types';
import { useToast } from '@/components/toast/ToastProvider';
import { walletApi } from '@/services/api';
import { useBackendResource } from '@/hooks/useBackendResource';
import { CACHE_POLICIES } from '@/services/cache';

export function ReceiveSheet() {
  const c = useColors();
  const { showToast } = useToast();
  const { data, error } = useBackendResource(walletApi.stats, CACHE_POLICIES.receive);
  useEffect(() => { if (error) showToast({ kind: 'error', title: 'Receive details', body: error }); }, [error, showToast]);
  const DETAILS = [
    { id: 'address', label: 'Address', icon: 'hash', tint: 'walletContactRemy', value: data?.wallet_address ?? '' },
    { id: 'email', label: 'Email', icon: 'mail', tint: 'walletContactZane', value: data?.email ?? '' },
    { id: 'username', label: 'Username', icon: 'at-sign', tint: 'walletContactMaya', value: data?.username ? `@${data.username}` : '' },
  ] as const;
  const { width } = useWindowDimensions();
  const [method, setMethod] = useState<RecipientMethod>('address');
  const [copyState, setCopyState] = useState<{ method: RecipientMethod; ok: boolean } | null>(null);
  const selected = DETAILS.find(detail => detail.id === method)!;
  // Encode the exact identifier shown below. No remote QR service or payment action.
  const qr = useMemo(() => {
    const cells = toQR(selected.value, 3);
    const side = Math.sqrt(cells.length);
    const runs: { row: number; start: number; length: number }[] = [];
    for (let row = 0; row < side; row++) {
      let col = 0;
      while (col < side) {
        if (!cells[row * side + col]) { col++; continue; }
        const start = col;
        while (col < side && cells[row * side + col]) col++;
        runs.push({ row, start, length: col - start });
      }
    }
    return { side, runs };
  }, [selected.value]);
  const cellSize = Math.max(1, Math.floor(Math.min(240, width - 80) / (qr.side + 8)));
  const qrSize = (qr.side + 8) * cellSize;
  const copy = async () => {
    const target = selected;
    try {
      if (!target.value) throw new Error('Your receive details have not loaded.');
      await copyText(target.value);
      setCopyState({ method: target.id, ok: true });
      showToast({ kind: 'success', title: `${target.label} copied`, body: 'Ready to paste.' });
    } catch {
      setCopyState({ method: target.id, ok: false });
      showToast({ kind: 'error', title: 'Could not copy', body: 'Please try again.' });
    }
  };
  const copied = copyState?.method === method && copyState.ok;
  const failed = copyState?.method === method && !copyState.ok;
  return (
    <View testID="wallet-receive-details" style={styles.wrap}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Receive by" style={styles.methods}>
        {DETAILS.map(detail => {
          const on = method === detail.id;
          return (
            <Pressable
              key={detail.id}
              testID={`wallet-receive-method-${detail.id}`}
              accessibilityRole="radio"
              accessibilityLabel={`Receive by ${detail.label}`}
              accessibilityState={{ selected: on, checked: on }}
              onPress={() => { setMethod(detail.id); setCopyState(null); }}
              style={styles.method}
            >
              <View style={[styles.ring, { borderColor: on ? c.walletInk : 'transparent' }]}>
                <View style={[styles.methodIcon, { backgroundColor: c[detail.tint] }]}>
                  <Feather name={detail.icon} size={23} color={c.walletContactInk} />
                </View>
              </View>
              <Text style={[styles.methodLabel, { color: on ? c.walletInk : c.walletSubtle, fontFamily: on ? 'DMSans_500Medium' : 'DMSans_400Regular' }]}>{detail.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View
        testID={`wallet-receive-qr-${method}`}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`QR code for ${selected.label.toLowerCase()}: ${selected.value}`}
        style={[styles.qr, { width: qrSize, height: qrSize, backgroundColor: c.walletQRBackground }]}
      >
        {qr.runs.map((run, index) => (
          <View key={index} style={{
            position: 'absolute',
            top: (run.row + 4) * cellSize,
            left: (run.start + 4) * cellSize,
            width: run.length * cellSize,
            height: cellSize,
            backgroundColor: c.walletQRInk,
          }} />
        ))}
      </View>
      <View style={[styles.details, { backgroundColor: c.walletField }]}>
        <View style={styles.detailHeader}>
          <Text style={[styles.label, { color: c.walletSubtle }]}>{selected.label}</Text>
          <Pressable
            testID="wallet-receive-copy"
            accessibilityRole="button"
            accessibilityLabel={`Copy ${selected.label.toLowerCase()}`}
            onPress={() => { void copy(); }}
            hitSlop={6}
            style={styles.copy}
          >
            <Feather name={copied ? 'check' : 'copy'} size={17} color={copied ? c.walletPositive : c.walletSubtle} />
          </Pressable>
        </View>
        <Text selectable testID={`wallet-receive-value-${method}`} style={[styles.value, { color: c.walletInk }]}>{selected.value}</Text>
        {(copied || failed) && <Text accessibilityLiveRegion="polite" style={[styles.feedback, { color: failed ? c.walletError : c.walletPositive }]}>{failed ? 'Could not copy. Try again.' : `${selected.label} copied`}</Text>}
      </View>
      <Text style={[styles.note, { color: c.walletSubtle }]}>Use these account identifiers to receive supported transfers within AtherChain.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 12, gap: 20 },
  methods: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 16 },
  method: { width: 80, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4, borderRadius: 12 },
  ring: { borderWidth: 2, padding: 3, borderRadius: 36 },
  methodIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  methodLabel: { fontSize: 12 },
  qr: { alignSelf: 'center' },
  details: { width: '100%', paddingHorizontal: 20, paddingBottom: 18, paddingTop: 10, borderRadius: 20, gap: 6 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  copy: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  value: { fontSize: 15, lineHeight: 23, fontFamily: 'DMSans_500Medium' },
  feedback: { fontSize: 12, fontFamily: 'DMSans_400Regular', marginTop: 4 },
  note: { fontSize: 11, lineHeight: 16, textAlign: 'center', fontFamily: 'DMSans_400Regular', paddingHorizontal: 12 },
});
