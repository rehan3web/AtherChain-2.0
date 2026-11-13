import React, { useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { copyText } from '@/utils/clipboard';
import { useColors } from '@/hooks/useColors';
import { ConfirmedIcon } from './ConfirmedIcon';
import { SEND_METHOD_LABELS, SendDetail, type SendDraft } from './SendConfirmation';
import { formatReceiptAmount, type Money } from './format';
import { ToastSurface, useToast } from '@/components/toast/ToastProvider';
import { useReceiptImage } from '@/hooks/useReceiptImage';

export type SendReceiptData = SendDraft & {
  reference: string; createdAt: string; demo: boolean;
  direction?: 'sent' | 'received';
  transactionTitle?: string;
  methodLabel?: string;
  status?: string;
};

export function SendReceipt({ receipt, money, onClose }: { receipt: SendReceiptData; money: Money; onClose: () => void }) {
  const c = useColors();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const { receiptRef, sharing, shareImage } = useReceiptImage('atherchain-transfer-receipt.png');
  const received = receipt.direction === 'received';
  const amount = formatReceiptAmount(money, receipt.amount);
  const copy = async () => {
    try {
      await copyText(receipt.reference);
      setCopied(true); setCopyError(false);
      showToast({ kind: 'success', title: 'Reference copied', body: 'Ready to paste.' });
    } catch {
      setCopyError(true);
      showToast({ kind: 'error', title: 'Could not copy reference', body: 'Please try again.' });
    }
  };
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <ToastSurface>
      <View testID="wallet-send-receipt" style={[styles.page, { backgroundColor: c.miningPage, paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 24 }]}>
        <View style={styles.header}>
          <Pressable testID="wallet-send-receipt-close" onPress={onClose} accessibilityRole="button" accessibilityLabel="Close send receipt" style={styles.button}><Feather name="x" size={24} color={c.walletInk} /></Pressable>
          <Pressable testID="wallet-send-receipt-share" onPress={() => { void shareImage(); }} disabled={sharing}
            accessibilityState={{ busy: sharing, disabled: sharing }} accessibilityRole="button" accessibilityLabel="Share send receipt image" accessibilityHint="Shares the full receipt as a PNG image" style={styles.button}>
            {sharing ? <ActivityIndicator color={c.walletInk} /> : <Feather name="share" size={22} color={c.walletInk} />}
          </Pressable>
        </View>
        <ScrollView testID="wallet-send-receipt-body" removeClippedSubviews={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          <View ref={receiptRef} collapsable={false} testID="wallet-send-receipt-image"
            style={[styles.content, { backgroundColor: c.miningPage, paddingBottom: Math.max(insets.bottom, 34) }]}>
            <View testID="wallet-send-receipt-summary" style={styles.summary}>
              <View style={[styles.symbol, { backgroundColor: c.walletField }]}><Feather name={received ? 'arrow-down' : 'arrow-up'} size={28} color={c.walletInk} /></View>
              <Text testID="wallet-send-receipt-amount" style={[styles.heading, { color: c.walletInk }]}>{amount}</Text>
              <Text testID="wallet-send-receipt-date" style={[styles.note, { color: c.walletSubtle }]}>{receipt.createdAt}</Text>
            </View>
            <View testID="wallet-send-receipt-details" style={styles.details}>
              <View testID="wallet-send-receipt-status" style={[styles.status, { borderBottomColor: c.walletDisabled }]}>
                <Text style={[styles.note, { color: c.walletSubtle }]}>Status</Text>
                <View style={styles.confirmed}><ConfirmedIcon /><Text style={[styles.value, { color: c.walletPositive }]}>{receipt.status && receipt.status !== 'completed' ? receipt.status : 'Confirmed'}</Text></View>
              </View>
              <SendDetail testID="wallet-send-receipt-type" label="Type" value={received ? 'Receive' : 'Send'} />
              <View testID="wallet-send-receipt-reference-row" style={[styles.reference, { borderBottomColor: c.walletDisabled }]}>
                <View style={styles.referenceHeader}>
                  <Text style={[styles.note, { color: c.walletSubtle }]}>Txn reference hash</Text>
                  <Pressable testID="wallet-send-reference-copy" onPress={() => { void copy(); }} accessibilityRole="button" accessibilityLabel="Copy send reference" style={styles.button}><Feather name={copied ? 'check' : 'copy'} size={16} color={c.walletSubtle} /></Pressable>
                </View>
                <Text selectable testID="wallet-send-reference" style={[styles.referenceText, { color: c.walletInk }]}>{receipt.reference}</Text>
                {(copied || copyError) && <Text testID="wallet-send-reference-feedback" accessibilityLiveRegion="polite" style={[styles.note, { color: copyError ? c.walletError : c.walletSubtle }]}>{copyError ? 'Could not copy. Try again.' : 'Reference copied'}</Text>}
              </View>
              <SendDetail testID="wallet-send-receipt-method" label={received ? 'Received via' : 'Send via'} value={receipt.methodLabel ?? SEND_METHOD_LABELS[receipt.recipient.method]} />
              <SendDetail testID="wallet-send-receipt-counterparty" label={received ? 'Sender' : 'Receiver'} value={receipt.recipient.value} />
              <SendDetail testID="wallet-send-receipt-amount-row" label="Amount" value={amount} />
              <SendDetail testID="wallet-send-receipt-footer-last-row" label="Fee" value="0" last />
            </View>
          </View>
        </ScrollView>
      </View>
      </ToastSurface>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, width: '100%' },
  header: { height: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, gap: 22 },
  summary: { alignItems: 'center', paddingTop: 24, paddingBottom: 8, gap: 12 },
  symbol: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 28, fontFamily: 'DMSans_600SemiBold', letterSpacing: -.6 },
  note: { fontSize: 12, lineHeight: 18, fontFamily: 'DMSans_400Regular' },
  value: { fontSize: 15, fontFamily: 'DMSans_500Medium' },
  details: { paddingHorizontal: 20 },
  status: { minHeight: 88, paddingVertical: 20, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmed: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reference: { paddingVertical: 20, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  referenceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  referenceText: { fontSize: 13, lineHeight: 21, fontFamily: 'DMSans_500Medium' },
});
