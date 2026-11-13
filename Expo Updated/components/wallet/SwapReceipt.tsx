import React, { useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { copyText } from '@/utils/clipboard';
import { useColors } from '@/hooks/useColors';
import { CoinLogo } from './SwapSheet';
import { ConfirmedIcon } from './ConfirmedIcon';
import { SWAP_FEE, SWAP_FEE_LABEL, swapUnits, type SwapCoin, type SwapReceiptData } from './swap-model';
import { ToastSurface, useToast } from '@/components/toast/ToastProvider';

/** Independent, edge-to-edge receipt screen, not constrained by the swap sheet. */
export function SwapReceipt({ receipt, onClose }: { receipt: SwapReceiptData; onClose: () => void }) {
  const c = useColors();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const { pay, receive, quote } = receipt;
  const copyReference = async () => {
    try {
      await copyText(receipt.reference);
      setCopied(true);
      setCopyError(false);
      showToast({ kind: 'success', title: 'Reference copied', body: 'Ready to paste.' });
    } catch {
      setCopyError(true);
      showToast({ kind: 'error', title: 'Could not copy reference', body: 'Please try again.' });
    }
  };
  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <ToastSurface>
      <View testID="wallet-swap-receipt" style={[styles.page, { backgroundColor: c.miningPage, paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 24 }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} testID="wallet-receipt-close" accessibilityRole="button" accessibilityLabel="Close receipt" style={styles.icon}>
            <Feather name="x" size={24} color={c.walletInk} />
          </Pressable>
          <Pressable onPress={() => { void Share.share({ message: `AtherChain swap\n${receipt.quote.amount} ${receipt.pay.sym} → ${receipt.quote.receiveAmount} ${receipt.receive.sym}\n${receipt.reference}` }).catch(() => showToast({ kind: 'error', title: 'Could not share receipt', body: 'Please retry.' })); }} testID="wallet-receipt-share" accessibilityRole="button" accessibilityLabel="Share receipt" accessibilityHint="Opens the share sheet" style={styles.icon}>
            <Feather name="share" size={22} color={c.walletInk} />
          </Pressable>
        </View>
        <ScrollView testID="wallet-swap-receipt-body" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 20) }]}>
            <View testID="wallet-swap-receipt-summary" style={styles.summary}>
              <View style={styles.pair}>
                <Asset coin={pay} />
                <View style={[styles.arrow, { backgroundColor: c.walletSheet }]}><Feather name="arrow-right" size={20} color={c.walletInk} /></View>
                <Asset coin={receive} />
              </View>
              <Text testID="wallet-swap-receipt-heading" style={[styles.heading, { color: c.walletInk }]}>{pay.sym} to {receive.sym}</Text>
              <Text testID="wallet-swap-receipt-date" style={[styles.note, { color: c.walletSubtle }]}>{receipt.createdAt}</Text>
            </View>
            <View testID="wallet-swap-receipt-details" style={styles.details}>
              <View testID="wallet-receipt-status" style={styles.status}>
                <Text style={[styles.note, { color: c.walletSubtle }]}>Status</Text>
                <View style={styles.statusValue}><ConfirmedIcon /><Text style={[styles.value, { color: c.walletPositive }]}>Confirmed</Text></View>
              </View>
              <Divider />
              <View testID="wallet-receipt-type" style={styles.status}>
                <Text style={[styles.note, { color: c.walletSubtle }]}>Type</Text>
                <Text style={[styles.value, { color: c.walletInk }]}>Swap</Text>
              </View>
              <Divider />
              <View testID="wallet-receipt-reference-row" style={styles.reference}>
                <View style={styles.row}>
                  <Text style={[styles.note, { color: c.walletSubtle }]}>Txn reference hash</Text>
                  <Pressable onPress={copyReference} testID="wallet-swap-copy-reference" accessibilityRole="button" accessibilityLabel="Copy transaction reference hash" style={styles.copy}>
                    <Feather name={copied ? 'check' : 'copy'} size={16} color={c.walletSubtle} />
                  </Pressable>
                </View>
                <Text selectable testID="wallet-swap-reference" style={[styles.referenceText, { color: c.walletInk }]}>{receipt.reference}</Text>
                {(copyError || copied) && <Text testID="wallet-swap-reference-feedback" accessibilityLiveRegion="polite" style={[styles.note, { color: copyError ? c.walletError : c.walletSubtle }]}>{copyError ? 'Could not copy. Try again.' : 'Reference copied'}</Text>}
              </View>
              <Divider />
              <ReceiptRow label="You Pay" value={`${swapUnits(quote.amount, pay)} ${pay.sym}`} coin={pay} testID="wallet-receipt-pay" />
              <Divider />
              <ReceiptRow label="You Receive" value={`${swapUnits(quote.receiveAmount, receive)} ${receive.sym}`} coin={receive} testID="wallet-receipt-receive" />
              <Divider />
              <ReceiptRow label="Swap fee" value={`${swapUnits(quote.feeAmount ?? quote.amount * SWAP_FEE, pay)} ${pay.sym}`} sub={`${SWAP_FEE_LABEL} · included in quote`} testID="wallet-receipt-fee" />
            </View>
        </ScrollView>
      </View>
      </ToastSurface>
    </Modal>
  );
}
function Asset({ coin }: { coin: SwapCoin }) {
  const c = useColors();
  return <View style={styles.asset}><CoinLogo coin={coin} size={56} /><Text style={[styles.assetSymbol, { color: c.walletInk }]}>{coin.sym}</Text><Text style={[styles.note, { color: c.walletSubtle }]}>{coin.name}</Text></View>;
}
function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.walletDisabled }} />;
}
function ReceiptRow({ label, value, sub, coin, testID, rowTestID }: { label: string; value: string; sub?: string; coin?: SwapCoin; testID?: string; rowTestID?: string }) {
  const c = useColors();
  return <View testID={rowTestID ?? (testID ? `${testID}-row` : undefined)} style={styles.detailRow}><Text style={[styles.note, { color: c.walletSubtle }]}>{label}</Text><View style={styles.detailValue}>{coin && <CoinLogo coin={coin} />}<View style={styles.amount}><Text testID={testID} numberOfLines={1} adjustsFontSizeToFit style={[styles.value, { color: c.walletInk }]}>{value}</Text>{sub && <Text style={[styles.note, { color: c.walletSubtle }]}>{sub}</Text>}</View></View></View>;
}
const styles = StyleSheet.create({
  page: { flex: 1, width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60 },
  icon: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 22 },
  summary: { alignItems: 'center', paddingTop: 24, paddingBottom: 8, gap: 12 },
  pair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 14 },
  asset: { alignItems: 'center', gap: 8, width: 104 },
  assetSymbol: { fontSize: 17, fontFamily: 'DMSans_600SemiBold' },
  arrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 24, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.6 },
  note: { fontSize: 12, lineHeight: 18, fontFamily: 'DMSans_400Regular' },
  details: { paddingHorizontal: 20 },
  status: { minHeight: 88, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reference: { paddingVertical: 20, gap: 8 },
  statusValue: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copy: { height: 32, width: 32, alignItems: 'center', justifyContent: 'center' },
  referenceText: { fontSize: 13, lineHeight: 21, fontFamily: 'DMSans_500Medium', fontVariant: ['tabular-nums'] },
  detailRow: { minHeight: 88, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detailValue: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  amount: { flexShrink: 1, alignItems: 'flex-end', gap: 5 },
  value: { fontSize: 15, fontFamily: 'DMSans_500Medium' },
});
