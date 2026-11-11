import React, { useEffect, useRef, useState } from 'react';
import { recordActivity } from '@/components/activity/store';
import { Animated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ScalePressable, useReducedMotion } from './primitives';
import { SlideConfirm } from './SlideConfirm';
import { AtherLogo } from './AtherLogo';
import { SWAP_COINS, SWAP_FEE_LABEL, swapQuote, swapUnits, type SwapCoin, type SwapReceiptData } from './swap-model';
import { NumericKeypad } from './NumericKeypad';
import { press, showRaw, useMoney } from './format';
import { useToast } from '@/components/toast/ToastProvider';

export function CoinLogo({ coin, size = 24 }: { coin: SwapCoin; size?: number }) {
  return (
    <View testID={`wallet-swap-logo-${coin.sym}`} style={[styles.logo, { width: size, height: size }]}>
      <AtherLogo size={size * 0.82} testID={`wallet-swap-logo-${coin.sym}-ather`} />
    </View>
  );
}

export function SwapSheet({ balance, onReviewChange, onReceipt }: { balance: number; onReviewChange: (review: boolean) => void; onReceipt: (receipt: SwapReceiptData) => void }) {
  const c = useColors();
  const { showToast } = useToast();
  const reduce = useReducedMotion();
  const compact = useWindowDimensions().height < 720;
  const m = useMoney('en-US', 'ATH');
  const [raw, setRaw] = useState('');
  const [review, setReview] = useState(false);
  const [done, setDone] = useState(false);
  const receiptCallback = useRef(onReceipt);
  receiptCallback.current = onReceipt;
  const entrance = useRef(new Animated.Value(0)).current;
  const [pay, receive] = SWAP_COINS;
  const amount = Number(raw || '0');
  const quote = swapQuote(pay, receive, amount);
  const cents = Math.round(amount * 100);
  const hasBalance = Number.isFinite(balance) && balance >= 0;
  const limitCents = hasBalance ? Math.max(0, Math.floor(balance * 100 + 1e-6)) : 0;
  const over = cents > limitCents;
  const valid = hasBalance && cents > 0 && !over;
  const shown = showRaw(raw, m);
  const quoteSnapshot = useRef<{ pay: SwapCoin; receive: SwapCoin; quote: ReturnType<typeof swapQuote> } | null>(null);
  const completedReceipt = useRef<SwapReceiptData | null>(null);
  const confirming = useRef(false);
  useEffect(() => {
    if (!done || !quoteSnapshot.current) return;
    const timestamp = Date.now();
    const receipt: SwapReceiptData = completedReceipt.current ?? {
      ...quoteSnapshot.current,
      reference: `demo-${timestamp.toString(16)}-${Math.random().toString(16).slice(2, 14)}`,
      createdAt: new Date(timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }),
    };
    if (!completedReceipt.current) {
      completedReceipt.current = receipt;
      recordActivity({
        id: receipt.reference, title: `${receipt.pay.sym} to ${receipt.receive.sym}`,
        timestamp, icon: 'repeat', value: `${swapUnits(receipt.quote.amount, receipt.pay)} ${receipt.pay.sym}`,
        preview: true, receipt: { type: 'swap', data: receipt },
      });
    }
    // Keep the completed slider visible briefly before opening the receipt.
    const timer = setTimeout(() => {
      showToast({ kind: 'success', title: 'Swap confirmed', body: 'Demo swap completed. No real assets were exchanged.' });
      receiptCallback.current(receipt);
    }, 850);
    return () => clearTimeout(timer);
  }, [done, showToast]);
  const openReview = () => {
    if (!valid) return;
    quoteSnapshot.current = { pay, receive, quote: swapQuote(pay, receive, amount) };
    setReview(true);
    onReviewChange(true);
    entrance.setValue(reduce ? 1 : 0);
    Animated.spring(entrance, { toValue: 1, damping: 26, stiffness: 230, useNativeDriver: true }).start();
  };
  const confirm = () => {
    if (confirming.current) return;
    confirming.current = true;
    setDone(true);
  };
  const setMax = () => {
    const cts = limitCents;
    const int = Math.floor(cts / 100);
    const dec = cts % 100;
    setRaw(cts === 0 ? '' : dec === 0 ? String(int) : `${int}.${String(dec).padStart(2, '0')}`);
  };

  if (review && quoteSnapshot.current) {
    const s = quoteSnapshot.current;
    return (
    <Animated.View style={[styles.review, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [200, 0] }) }] }]}>
      <View style={styles.summary}>
        <View style={styles.pair}><CoinLogo coin={s.pay} size={56} /><View style={[styles.direction, { backgroundColor: c.walletField }]}><Feather name="arrow-right" size={18} color={c.walletInk} /></View><CoinLogo coin={s.receive} size={56} /></View>
        <Text style={[styles.heading, { color: c.walletInk }]}>{done ? 'Demo swap confirmed' : `${s.pay.sym} to ${s.receive.sym}`}</Text>
        <Text style={[styles.note, { color: c.walletSubtle }]}>{done ? 'No real assets were exchanged.' : 'Review your swap details'}</Text>
      </View>
      <View testID="wallet-swap-review-details" style={[styles.details, { backgroundColor: c.walletField }]}>
        <Detail label="You Pay" value={`${swapUnits(s.quote.amount, s.pay)} ${s.pay.sym}`} coin={s.pay} testID="wallet-swap-review-pay" />
        <View style={{ height: 1, backgroundColor: c.walletDisabled }} />
        <Detail label="You Receive" value={`${swapUnits(s.quote.receiveAmount, s.receive)} ${s.receive.sym}`} coin={s.receive} testID="wallet-swap-review-receive" />
        <View style={{ height: 1, backgroundColor: c.walletDisabled }} />
        <Detail label="Fee" value={`${swapUnits(s.quote.feeAmount, s.pay)} ${s.pay.sym}`} sub={`${SWAP_FEE_LABEL} · fixed 1 AT = 1 ATH`} testID="wallet-swap-review-fee" />
      </View>
      <View style={styles.footer}>
        <Text style={[styles.disclaimer, { color: c.walletSubtle }]}>Practice swap · no real assets are exchanged.{'\n'}Your wallet balance will not change.</Text>
        <SlideConfirm onConfirm={confirm} />
      </View>
    </Animated.View>
    );
  }

  return (
    <View style={[styles.wrap, compact && { gap: 6 }]} testID="wallet-swap-entry">
      <View testID="wallet-swap-fields" style={[styles.fields, compact && styles.compactFields]}>
      <View style={[styles.slabs, { backgroundColor: c.walletField }]}>
        <View testID="wallet-swap-pay-field" style={[styles.face, compact && styles.compactFace]}>
          <View testID="wallet-swap-pay-header" style={styles.fieldHeader}>
            <View testID="wallet-swap-token-0" style={[styles.coinPill, { backgroundColor: c.walletFieldPressed }]}><CoinLogo coin={pay} size={22} /><Text style={[styles.symbol, { color: c.walletInk }]}>{pay.sym}</Text></View>
            <Text style={[styles.label, { color: c.walletMuted }]}>You pay</Text>
          </View>
          <View testID="wallet-swap-pay-amount-row" style={styles.entryRow}>
            <View style={styles.amountValue}>
            <Text
              testID="wallet-swap-amount-0"
              accessibilityLabel={`You pay ${shown} ${pay.sym}`}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.amount, styles.bigAmount, compact && { fontSize: 28 }, { color: raw ? (over ? c.walletError : c.walletInk) : c.walletDisabled }]}
            >{shown}</Text>
              <Text style={[styles.amountUnit, { color: c.walletMuted }]}>{pay.sym}</Text>
            </View>
            <ScalePressable
              onPress={setMax}
              accessibilityRole="button"
              accessibilityLabel="Use maximum practice amount"
              accessibilityState={{ disabled: limitCents === 0 }}
              disabled={limitCents === 0}
              testID="wallet-swap-max"
              style={[styles.max, { backgroundColor: c.walletInk, opacity: limitCents === 0 ? 0.5 : 1 }]}
            >
              <Text testID="wallet-swap-max-label" style={[styles.symbol, { color: c.walletOnInk }]}>Max</Text>
            </ScalePressable>
          </View>
          <Text testID="wallet-swap-limit" style={[styles.note, { color: c.walletSubtle }]}>{hasBalance ? `Practice limit ${m.num(balance)} AT` : 'Practice balance unavailable'}</Text>
        </View>
        <View style={[styles.divider, { backgroundColor: c.walletSheet }]}>
          <View style={[styles.flip, { backgroundColor: c.walletFieldPressed }]}><Feather name="arrow-down" size={16} color={c.walletInk} /></View>
        </View>
        <View testID="wallet-swap-receive-field" style={[styles.face, compact && styles.compactFace]}>
          <View testID="wallet-swap-receive-header" style={styles.fieldHeader}>
            <View testID="wallet-swap-token-1" style={[styles.coinPill, { backgroundColor: c.walletFieldPressed }]}><CoinLogo coin={receive} size={22} /><Text style={[styles.symbol, { color: c.walletInk }]}>{receive.sym}</Text></View>
            <Text style={[styles.label, { color: c.walletMuted }]}>You receive</Text>
          </View>
          <View testID="wallet-swap-receive-amount-row" style={styles.entryRow}>
            <View style={styles.amountValue}>
              <Text testID="wallet-swap-amount-1" numberOfLines={1} adjustsFontSizeToFit style={[styles.amount, styles.bigAmount, compact && { fontSize: 28 }, { color: raw ? c.walletInk : c.walletDisabled }]}>{swapUnits(quote.receiveAmount, receive)}</Text>
              <Text style={[styles.amountUnit, { color: c.walletMuted }]}>{receive.sym}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.status} accessibilityLiveRegion="polite">
        {!hasBalance ? (
          <Text testID="wallet-swap-error" accessibilityRole="alert" style={[styles.disclaimer, { color: c.walletError }]}>Practice balance unavailable</Text>
        ) : over ? (
          <Text testID="wallet-swap-error" accessibilityRole="alert" style={[styles.disclaimer, { color: c.walletError }]}>More than your practice limit of {m.num(balance)} AT</Text>
        ) : (
          <Text testID="wallet-swap-rate" style={[styles.disclaimer, { color: c.walletSubtle }]}>{`1 AT = 1 ATH · ${SWAP_FEE_LABEL} fee · Practice only`}</Text>
        )}
      </View>
      </View>
      <View style={[styles.bottom, compact && { gap: 8 }]}>
        <NumericKeypad
          testIDPrefix="wallet-swap-key"
          decimal={m.decimal}
          onKey={(k) => setRaw((r) => press(r, k))}
          onClear={() => setRaw('')}
        />
        <ScalePressable
          onPress={openReview}
          disabled={!valid}
          accessibilityRole="button"
          accessibilityLabel="Swap"
          accessibilityState={{ disabled: !valid }}
          testID="wallet-swap-review"
          style={[styles.button, { backgroundColor: valid ? c.walletInk : c.walletDisabled }]}
        >
          <Text style={[styles.buttonText, { color: c.walletOnInk }]}>Swap</Text><Feather name="arrow-right" size={18} color={c.walletOnInk} />
        </ScalePressable>
      </View>
    </View>
  );
}

function Detail({ label, value, sub, coin, testID }: { label: string; value: string; sub?: string; coin?: SwapCoin; testID?: string }) {
  const c = useColors();
  return <View style={styles.detail}><Text style={[styles.note, { color: c.walletSubtle }]}>{label}</Text><View style={styles.detailValue}>{coin && <CoinLogo coin={coin} />}<View style={{ alignItems: 'flex-end', flexShrink: 1 }}><Text testID={testID} numberOfLines={1} adjustsFontSizeToFit style={[styles.value, { color: c.walletInk }]}>{value}</Text>{sub ? <Text style={[styles.note, { color: c.walletSubtle }]}>{sub}</Text> : null}</View></View></View>;
}
const styles = StyleSheet.create({
  // Match OTP's 560px shell minus its 24px horizontal padding on each side.
  wrap: { flexGrow: 1, width: '100%', maxWidth: 512, alignSelf: 'center', gap: 12 },
  fields: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', gap: 12, paddingVertical: 24 },
  compactFields: { gap: 6, paddingVertical: 12 },
  slabs: { width: '100%', borderRadius: 20, overflow: 'hidden' },
  face: { minHeight: 144, paddingHorizontal: 20, paddingVertical: 20, gap: 12 },
  compactFace: { minHeight: 128, paddingVertical: 14, gap: 10 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  label: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  entryRow: { flexDirection: 'row', alignItems: 'center', gap: 20, minHeight: 44 },
  amountValue: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  amountUnit: { fontSize: 16, fontFamily: 'DMSans_500Medium' },
  amount: { fontSize: 22, fontFamily: 'DMSans_500Medium', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  bigAmount: { flexShrink: 1, fontSize: 32, letterSpacing: -0.8 },
  max: { minWidth: 64, height: 44, paddingHorizontal: 16, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 2, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  status: { minHeight: 19, justifyContent: 'center' },
  bottom: { marginTop: 'auto', gap: 12 },
  note: { fontSize: 12, fontFamily: 'DMSans_400Regular' },
  coinPill: { height: 30, borderRadius: 15, paddingLeft: 4, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  symbol: { fontSize: 13, fontFamily: 'DMSans_500Medium' },
  logo: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  flip: { height: 32, width: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontSize: 16, fontFamily: 'DMSans_500Medium' },
  disclaimer: { fontSize: 12, lineHeight: 19, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
  review: { flex: 1, gap: 20, paddingTop: 8 },
  summary: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  pair: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 8 },
  direction: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 24, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.6, textAlign: 'center' },
  details: { borderRadius: 24, paddingHorizontal: 20 },
  detail: { minHeight: 88, paddingVertical: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  detailValue: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  value: { fontFamily: 'DMSans_500Medium', fontSize: 16, marginBottom: 5 },
  footer: { marginTop: 'auto', gap: 18, paddingTop: 24 },
});
