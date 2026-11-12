import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';
import { useTheme } from '@/hooks/useTheme';
import { ActivityList } from './ActivityList';
import { DEFAULT_CONTACTS, DEFAULT_TRANSACTIONS } from './defaults';
import { fmtDate, formatReceiptAmount, useMoney } from './format';
import { AnimatedAmount, EASE_OUT, ScalePressable, TxIcon, useReducedMotion } from './primitives';
import { SettingsSheet } from './SettingsSheet';
import { Sheet } from './Sheet';
import { TransferSheet } from './TransferSheet';
import { ReceiveSheet } from './ReceiveSheet';
import { SendReceipt, type SendReceiptData } from './SendReceipt';
import { transactionReceipt } from './transactionReceipt';
import { SwapSheet } from './SwapSheet';
import { SwapReceipt } from './SwapReceipt';
import type { SwapReceiptData } from './swap-model';
import type { MoneyCardProps, SheetConfig, Transaction, TransferRequest } from './types';

const SHEET_TITLES = { send: 'Send money', request: 'Receive money', swap: 'Swap', activity: 'Activity', settings: 'Settings' } as const;
const clamp = (min: number, v: number, max: number) => Math.min(max, Math.max(min, v));

// Without a configured handler we never pretend a payment happened.
const notConfigured = (what: string) => async (_req: TransferRequest) => {
  throw new Error(`${what} isn't set up in this app. Nothing was sent.`);
};

export function MoneyCard({
  balance = 0,
  contacts = DEFAULT_CONTACTS,
  transactions = DEFAULT_TRANSACTIONS,
  onSend,
  onViewAll,
  currency = 'ATH',
  locale = 'en-US',
  paymentLink,
  demo = false,
  fullScreen = false,
  style,
}: MoneyCardProps) {
  const c = useColors();
  const isDark = useTheme().scheme === 'dark';
  const sendColors: [string, string] = isDark ? ['#ffffff', '#f4f4f5'] : [c.walletDarkTop, c.walletDarkBottom];
  const sendInk = isDark ? '#18181b' : c.walletOnInk;
  const m = useMoney(locale, currency);
  const isAth = m.symbol === 'ATH';
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? 67 : insets.top;
  // Container-query equivalent: 1 unit = 1% of card width
  const W = Math.min(width - (fullScreen ? 0 : 32), 480);
  const q = W / 100;
  const av = clamp(44, 12.6 * q, 62);
  const actionH = clamp(46, 13.2 * q, 62);

  const [sheet, setSheet] = useState<SheetConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [swapReview, setSwapReview] = useState(false);
  const [sendReview, setSendReview] = useState(false);
  const [sendReceipt, setSendReceipt] = useState<SendReceiptData | null>(null);
  const pendingSendReceipt = useRef<SendReceiptData | null>(null);
  const [swapReceipt, setSwapReceipt] = useState<SwapReceiptData | null>(null);
  const pendingReceipt = useRef<SwapReceiptData | null>(null);
  const [hidden, setHidden] = useState(false);
  const locked = useRef(false);

  const handleSend = onSend ?? notConfigured('Sending');

  const show = (cfg: SheetConfig) => {
    setSwapReview(false);
    setSendReview(false);
    setSendReceipt(null);
    pendingSendReceipt.current = null;
    setSwapReceipt(null);
    pendingReceipt.current = null;
    setSheet(cfg);
    setOpen(true);
  };
  const close = () => {
    if (locked.current) return; // can't dismiss mid-payment
    if (sendReview) setSendReview(false);
    else setOpen(false);
  };
  const openTransaction = (transaction: Transaction) => {
    if (locked.current || sendReceipt || pendingSendReceipt.current) return;
    const receipt = transactionReceipt(transaction, locale);
    if (open && sheet) {
      pendingSendReceipt.current = receipt;
      setOpen(false);
    } else {
      setSendReceipt(receipt);
    }
  };

  const last = transactions[0];
  const body = clamp(15, 4.6 * q, 21);

  return (
    <View style={[styles.outer, fullScreen ? styles.fullScreenOuter : { maxWidth: 480 }, style]}>
      <LinearGradient
        colors={[c.walletCardTop, c.walletCardBottom]}
        style={[
          styles.card,
          { borderRadius: clamp(28, 8 * q, 40), padding: 3 * q, shadowColor: c.walletShadow },
          fullScreen && styles.fullScreenCard,
        ]}
        accessibilityLabel="Wallet"
      >
        {/* Balance panel */}
        <LinearGradient
          colors={c.walletBlue}
          locations={[0, 0.24, 0.52, 0.78, 1]}
          start={{ x: 0.36, y: 0 }}
          end={{ x: 0.6, y: 1 }}
          style={[{
            paddingHorizontal: 5 * q,
            paddingTop: 4.6 * q,
            paddingBottom: av / 2 + 4.4 * q,
            borderTopLeftRadius: clamp(26, 11 * q, 52),
            borderTopRightRadius: clamp(26, 11 * q, 52),
            borderBottomLeftRadius: clamp(30, 13 * q, 62),
            borderBottomRightRadius: clamp(30, 13 * q, 62),
          }, fullScreen && {
            paddingTop: topInset + 32,
            paddingBottom: av / 2 + 4.4 * q + 20,
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          }]}
        >
          {/* Preserve the balance layout without a network selector. */}
          <View style={{ height: 36 }} />

          <View style={[styles.centerRow, { marginTop: 1.6 * q }]}>
            <View style={[styles.balancePill, { paddingHorizontal: 3.4 * q, paddingVertical: 1.2 * q, borderColor: c.walletGlassBorder }]}>
              <Text style={[styles.balanceLabel, { fontSize: clamp(10, 2.9 * q, 13), color: c.walletOnBlueMuted }]}>Your balance</Text>
            </View>
          </View>

          <View
            accessible
            accessibilityLiveRegion="polite"
            accessibilityLabel={hidden ? 'Balance hidden' : isAth ? `Balance ${m.num(balance)} ATH` : `Balance ${m.full(balance)}`}
            testID="wallet-balance"
            style={[styles.centerRow, { marginTop: 4.4 * q }, isAth && styles.baselineRow]}
          >
            {isAth ? (
              <>
                <View testID="wallet-balance-amount" style={{ flexShrink: 1 }}>
                  {hidden ? (
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.balance, { fontSize: clamp(30, 10.6 * q, 54), color: c.walletOnBlue }]}>••••••</Text>
                  ) : (
                    <AnimatedAmount
                      value={balance}
                      format={(v) => Number.isFinite(balance) ? m.num(v) : '—'}
                      style={[styles.balance, { fontSize: clamp(30, 10.6 * q, 54), color: c.walletOnBlue }]}
                    />
                  )}
                </View>
                <Text testID="wallet-balance-unit" style={[styles.unit, { fontSize: clamp(15, 4.6 * q, 20), color: c.walletOnBlue }]}>ATH</Text>
              </>
            ) : hidden ? (
              <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.balance, { fontSize: clamp(30, 10.6 * q, 54), color: c.walletOnBlue }]}>
                {m.symbol} ••••••
              </Text>
            ) : (
              <AnimatedAmount
                value={balance}
                format={(v) => m.full(v)}
                style={[styles.balance, { fontSize: clamp(30, 10.6 * q, 54), color: c.walletOnBlue }]}
              />
            )}
          </View>
        </LinearGradient>

        {/* Actions directly below the balance panel */}
        <View style={[
          styles.row,
          { marginTop: fullScreen ? 24 : 3.4 * q, gap: 1.8 * q },
          fullScreen && { marginHorizontal: 16 },
        ]}>
          <Surface size={actionH} label="Settings" testID="wallet-settings" onPress={() => show({ type: 'settings' })}>
            <Feather name="settings" size={22} color={c.walletInkSoft} />
          </Surface>
          <Surface size={actionH} label="Activity — open Swap" testID="wallet-activity" onPress={() => show({ type: 'swap' })}>
            <Feather name="repeat" size={20} color={c.walletInkSoft} style={{ transform: [{ rotate: '90deg' }] }} />
          </Surface>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Receive money"
            testID="wallet-receive"
            onPress={() => show({ type: 'request' })}
            scaleTo={0.97}
            style={{ flex: 1.15, minWidth: 0 }}
          >
            <LinearGradient
              colors={[c.walletSurfaceTop, c.walletSurfaceBottom]}
              style={[styles.pill, styles.lightShadow, { height: actionH, borderRadius: actionH / 2 }]}
            >
              <Text numberOfLines={1} style={[styles.pillText, { fontSize: body, color: c.walletInk }]}>Receive</Text>
              <Feather name="arrow-down" size={body * 1.1} color={c.walletInk} />
            </LinearGradient>
          </ScalePressable>
          <ScalePressable
            accessibilityRole="button"
            accessibilityLabel="Send money"
            testID="wallet-send"
            onPress={() => show({ type: 'send' })}
            scaleTo={0.97}
            style={{ flex: 1, minWidth: 0 }}
          >
            <LinearGradient
              testID="wallet-send-surface"
              colors={sendColors}
              style={[styles.pill, styles.darkShadow, { height: actionH, borderRadius: actionH / 2 }]}
            >
              <View style={[styles.sheen, { borderRadius: actionH }]} pointerEvents="none" />
              <Text numberOfLines={1} style={[styles.pillText, { fontSize: body, color: sendInk }]}>Send</Text>
              <Feather name="arrow-up" size={body * 1.1} color={sendInk} />
            </LinearGradient>
          </ScalePressable>
        </View>

        {/* Transaction history fills the space below the actions */}
        <LinearGradient
          colors={[c.walletCardTop, c.walletInset]}
          style={{
            marginTop: fullScreen ? 24 : 3.4 * q,
            marginHorizontal: fullScreen ? 16 : 0,
            marginBottom: fullScreen ? 16 : 0,
            borderRadius: clamp(22, 6.4 * q, 32),
            padding: 4.6 * q,
            ...(fullScreen ? { flex: 1, minHeight: 0 } : {}),
          }}
        >
          <View style={styles.rowBetween}>
            <Text style={[styles.reg, { fontSize: clamp(12, 3.4 * q, 15), color: c.walletMuted }]}>
              {fullScreen ? 'Transactions' : 'Last transaction'}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View all transactions"
              testID="wallet-view-all"
              hitSlop={10}
              onPress={() => (onViewAll ? onViewAll() : show({ type: 'activity' }))}
            >
              <Text style={[styles.reg, styles.underline, { fontSize: clamp(12, 3.4 * q, 15), color: c.walletInkSoft }]}>View all</Text>
            </Pressable>
          </View>
          <View style={[
            { marginTop: 3 * q },
            fullScreen
              ? { flex: 1, minHeight: 0 }
              : { minHeight: clamp(44, 12 * q, 56), justifyContent: 'center' },
          ]}>
            {fullScreen ? (
              <ScrollView
                style={{ flex: 1 }}
                showsVerticalScrollIndicator={false}
                testID="wallet-transactions-scroll"
              >
                <ActivityList transactions={transactions} money={m} locale={locale} onSelect={openTransaction} />
              </ScrollView>
            ) : last ? (
              <LastTx key={last.id} tx={last} q={q} locale={locale} fmt={value => formatReceiptAmount(m, value)} onPress={() => openTransaction(last)} />
            ) : (
              <Text style={[styles.reg, { fontSize: 15, color: c.walletMuted }]}>No transactions yet</Text>
            )}
          </View>
        </LinearGradient>

      </LinearGradient>

      <Sheet
        open={open}
        title={swapReview ? 'Confirm swap' : sendReview ? 'Confirm send' : sheet ? SHEET_TITLES[sheet.type] : ''}
        fullScreen={sheet?.type === 'swap' || (sheet?.type === 'send' && sendReview)}
        surface={sheet?.type === 'swap' && !swapReview ? 'sheet' : undefined}
        onClose={close}
        onExited={() => {
          setSheet(null);
          setSwapReview(false);
          setSendReview(false);
          if (pendingReceipt.current) {
            setSwapReceipt(pendingReceipt.current);
            pendingReceipt.current = null;
          }
          if (pendingSendReceipt.current) {
            setSendReceipt(pendingSendReceipt.current);
            pendingSendReceipt.current = null;
          }
        }}
      >
        {sheet?.type === 'swap' && <SwapSheet balance={balance} onReviewChange={setSwapReview} onBusyChange={busy => { locked.current = busy; }} onReceipt={(receipt) => {
          pendingReceipt.current = receipt;
          setOpen(false);
        }} />}
        {sheet?.type === 'request' && <ReceiveSheet />}
        {sheet?.type === 'send' && (
          <TransferSheet
            mode="send"
            contacts={contacts}
            initialContactId={sheet.contactId}
            balance={balance}
            money={m}
            paymentLink={paymentLink}
            demo={demo}
            onSubmit={handleSend}
            onClose={close}
            lock={locked}
            onReviewChange={setSendReview}
            reviewOpen={sendReview}
            onReceipt={receipt => {
              pendingSendReceipt.current = receipt;
              setOpen(false);
            }}
          />
        )}
        {sheet?.type === 'activity' && <ActivityList transactions={transactions} money={m} locale={locale} onSelect={openTransaction} />}
        {sheet?.type === 'settings' && (
          <SettingsSheet hidden={hidden} onHiddenChange={setHidden} />
        )}
      </Sheet>
      {swapReceipt && <SwapReceipt receipt={swapReceipt} onClose={() => setSwapReceipt(null)} />}
      {sendReceipt && <SendReceipt receipt={sendReceipt} money={m} onClose={() => setSendReceipt(null)} />}
    </View>
  );
}

function Surface({
  size,
  label,
  testID,
  onPress,
  children,
}: {
  size: number;
  label: string;
  testID: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const c = useColors();
  return (
    <ScalePressable accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={onPress} scaleTo={0.96}>
      <LinearGradient
        colors={[c.walletSurfaceTop, c.walletSurfaceBottom]}
        style={[styles.circle, styles.lightShadow, { width: size, height: size, borderRadius: size / 2 }]}
      >
        {children}
      </LinearGradient>
    </ScalePressable>
  );
}

function LastTx({ tx, q, locale, fmt, onPress }: { tx: Transaction; q: number; locale: string; fmt: (v: number) => string; onPress: () => void }) {
  const c = useColors();
  const reduce = useReducedMotion();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: reduce ? 0 : 280, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [a, reduce]);
  const size = clamp(44, 12.4 * q, 58);
  return (
    <Pressable
      accessible
      accessibilityRole="button"
                accessibilityHint="Open transaction receipt"
      onPress={onPress}
      accessibilityLabel={`Last transaction: ${tx.title}, ${fmtDate(tx.date, locale)}, ${tx.amount > 0 ? 'received' : 'sent'} ${fmt(Math.abs(tx.amount))}`}
      testID="wallet-last-transaction"
    >
    <Animated.View
      style={[
        styles.row,
        { gap: 3.2 * q, opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [reduce ? 0 : 14, 0] }) }] },
      ]}
    >
      <TxIcon tx={tx} size={size} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[styles.txTitle, { fontSize: clamp(15, 4.2 * q, 19), color: c.walletInk }]}>{tx.title}</Text>
        <Text style={[styles.reg, { marginTop: 2, fontSize: clamp(12, 3.3 * q, 15), color: c.walletMuted }]}>
          {fmtDate(tx.date, locale)}
        </Text>
      </View>
      <Text style={[styles.txAmt, { fontSize: clamp(18, 5.2 * q, 24), color: tx.amount > 0 ? c.walletPositive : c.walletInk }]}>
        {tx.amount > 0 ? '+' : ''}
        {fmt(Math.abs(tx.amount))}
      </Text>
    </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { width: '100%', alignSelf: 'center' },
  fullScreenOuter: { flex: 1, minHeight: 0 },
  fullScreenCard: {
    flex: 1,
    minHeight: 0,
    padding: 0,
    borderRadius: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  card: {
    shadowOpacity: 0.22,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centerRow: { flexDirection: 'row', justifyContent: 'center' },
  userAvatar: {
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userName: { fontFamily: 'DMSans_500Medium', flexShrink: 1 },
  demoPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  demoText: { fontSize: 11, fontFamily: 'DMSans_600SemiBold', letterSpacing: 0.2 },
  balancePill: { borderRadius: 999, borderWidth: 1, backgroundColor: 'rgba(255,255,255,0.15)' },
  balanceLabel: { fontFamily: 'DMSans_500Medium', textTransform: 'uppercase', letterSpacing: 0.6 },
  balance: { fontFamily: 'DMSans_600SemiBold', letterSpacing: -1.6, fontVariant: ['tabular-nums'] },
  baselineRow: { alignItems: 'baseline', gap: 8 },
  unit: { fontFamily: 'DMSans_500Medium' },
  reg: { fontFamily: 'DMSans_400Regular' },
  underline: { textDecorationLine: 'underline' },
  txTitle: { fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.2 },
  txAmt: { alignSelf: 'flex-end', fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.4, fontVariant: ['tabular-nums'] },
  circle: { alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', paddingHorizontal: 8 },
  pillText: { fontFamily: 'DMSans_500Medium', flexShrink: 1 },
  lightShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  darkShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sheen: { position: 'absolute', left: '12%', top: '4%', width: '46%', height: '46%', backgroundColor: 'rgba(255,255,255,0.14)' },
});
