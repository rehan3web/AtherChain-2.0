import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { Money } from './format';
import type { TransferRecipient } from './types';
import { SlideConfirm } from './SlideConfirm';

export type SendDraft = { recipient: TransferRecipient; amount: number; note: string };
export const SEND_METHOD_LABELS = { email: 'Email', username: 'Username', address: 'Address' } as const;

export function SendConfirmation({ draft, money, status, error, attempt, demo, onConfirm }: {
  draft: SendDraft; money: Money; status: 'idle' | 'pending' | 'confirmed';
  error: string | null; attempt: number; demo?: boolean; onConfirm: () => void;
}) {
  const c = useColors();
  return (
    <View testID="wallet-send-confirmation" style={styles.page}>
      <View style={styles.summary}>
        <View style={[styles.icon, { backgroundColor: c.walletField }]}><Feather name="arrow-up" size={26} color={c.walletInk} /></View>
        <Text style={[styles.heading, { color: c.walletInk }]}>Send</Text>
        <Text style={[styles.note, { color: c.walletSubtle }]}>Review your transfer details</Text>
      </View>
      <View style={[styles.details, { backgroundColor: c.walletField }]}>
        <SendDetail label="Send via" value={SEND_METHOD_LABELS[draft.recipient.method]} />
        <SendDetail label="Receiver" value={draft.recipient.value} />
        <SendDetail label="Amount" value={money.full(draft.amount)} />
        <SendDetail label="Fee" value="0" last />
      </View>
      <View style={styles.footer}>
        {error && <Text testID="wallet-send-confirm-error" accessibilityRole="alert" style={[styles.note, { color: c.walletError }]}>{error}</Text>}
        {demo && <Text style={[styles.note, { color: c.walletSubtle, textAlign: 'center' }]}>Demo transfer only. No real money moves.</Text>}
        <SlideConfirm
          key={attempt}
          operationLabel={demo ? 'demo send' : 'send'}
          testID="wallet-send-slider"
          status={status}
          onConfirm={onConfirm}
        />
      </View>
    </View>
  );
}

export function SendDetail({ label, value, last = false, testID }: { label: string; value: string; last?: boolean; testID?: string }) {
  const c = useColors();
  return (
    <View testID={testID} style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.walletDisabled }]}>
      <Text style={[styles.note, { color: c.walletSubtle }]}>{label}</Text>
      <Text selectable testID={testID ? `${testID}-value` : undefined} style={[styles.value, { color: c.walletInk }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingTop: 8, gap: 20 },
  summary: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 24, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.6 },
  note: { fontSize: 12, lineHeight: 18, fontFamily: 'DMSans_400Regular' },
  details: { borderRadius: 24, paddingHorizontal: 20 },
  row: { minHeight: 88, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  value: { fontSize: 15, lineHeight: 22, fontFamily: 'DMSans_500Medium', textAlign: 'right', flexShrink: 1, maxWidth: '70%' },
  footer: { marginTop: 'auto', paddingTop: 24, gap: 18 },
});
