import React, { type MutableRefObject, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { MAX_VISIBLE_CONTACTS, type Money, press, showRaw, uid } from './format';
import { NumericKeypad } from './NumericKeypad';
import { CopyLink, Face, ScalePressable } from './primitives';
import type { Contact, RecipientMethod, TransferRequest } from './types';
import { normalizeRecipient, recipientError } from './recipient';
import { LockInput } from '@/components/inputs';
import { SendConfirmation, type SendDraft } from './SendConfirmation';
import type { SendReceiptData } from './SendReceipt';
import { useToast } from '@/components/toast/ToastProvider';

const METHODS: { id: RecipientMethod; label: string; icon: 'mail' | 'at-sign' | 'hash'; tint: 'walletContactZane' | 'walletContactMaya' | 'walletContactRemy'; ink: string; placeholder: string; keyboard: 'email-address' | 'default'; help: string }[] = [
  { id: 'email', label: 'Email', icon: 'mail', tint: 'walletContactZane', ink: '#2f6b3a', placeholder: 'Email', keyboard: 'email-address', help: "Enter the recipient's email address." },
  { id: 'username', label: 'Username', icon: 'at-sign', tint: 'walletContactMaya', ink: '#4f3f8f', placeholder: 'Username', keyboard: 'default', help: '3 to 32 letters, numbers, underscores or dots.' },
  { id: 'address', label: 'Address', icon: 'hash', tint: 'walletContactRemy', ink: '#8f2f3a', placeholder: 'Address', keyboard: 'default', help: 'Enter an AtherChain wallet address. External transfers are not supported.' },
];


export function TransferSheet({
  mode,
  contacts,
  initialContactId,
  balance,
  money: m,
  paymentLink,
  demo,
  onSubmit,
  onClose,
  lock,
  onReviewChange,
  onReceipt,
  reviewOpen,
}: {
  mode: 'send' | 'request';
  contacts: Contact[];
  initialContactId?: string;
  balance: number;
  money: Money;
  paymentLink?: string;
  demo?: boolean;
  onSubmit: (req: TransferRequest) => Promise<void | SendReceiptData>;
  onClose: () => void;
  lock: MutableRefObject<boolean>;
  onReviewChange: (review: boolean) => void;
  onReceipt: (receipt: SendReceiptData) => void;
  reviewOpen: boolean;
}) {
  const c = useColors();
  const { showToast } = useToast();
  const [contactId, setContactId] = useState<string | null>(initialContactId ?? null);
  const [method, setMethod] = useState<RecipientMethod>('email');
  const [drafts, setDrafts] = useState<Record<RecipientMethod, string>>({ email: '', username: '', address: '' });
  const [touched, setTouched] = useState<Record<RecipientMethod, boolean>>({ email: false, username: false, address: false });
  const [raw, setRaw] = useState('');
  const [status, setStatus] = useState<'idle' | 'pending' | 'confirmed'>('idle');
  const [review, setReview] = useState<SendDraft | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ amount: number; name: string } | null>(null);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const receiptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (receiptTimer.current) clearTimeout(receiptTimer.current);
    };
  }, []);

  const contact = contacts.find((x) => x.id === contactId) ?? null;
  const cents = Math.round(parseFloat(raw || '0') * 100);
  const isSend = mode === 'send';
  const over = isSend && cents > Math.round(balance * 100);
  const draft = drafts[method];
  const recipErr = isSend ? recipientError(method, draft) : null;
  const showRecipErr = isSend && touched[method] ? recipErr : null;
  const recipient = isSend && !recipErr ? normalizeRecipient(method, draft) : null;
  const target = isSend ? recipient?.value ?? null : contact?.name ?? null;
  const valid = (isSend ? !!recipient : !!contact) && cents > 0 && !over;
  const meta = METHODS.find((x) => x.id === method)!;
  const pending = status === 'pending';

  useEffect(() => {
    lock.current = pending || status === 'confirmed';
    return () => {
      lock.current = false;
    };
  }, [pending, status, lock]);

  const confirmSend = async () => {
    if (!review || submitting.current || status !== 'idle') return;
    submitting.current = true;
    lock.current = true;
    setStatus('pending');
    setError(null);
    let succeeded = false;
    try {
      const invalid = recipientError(review.recipient.method, review.recipient.value);
      if (invalid) throw new Error(invalid);
      if (!Number.isFinite(review.amount) || review.amount <= 0) throw new Error('Enter a valid amount.');
      if (Math.round(review.amount * 100) > Math.round(balance * 100)) throw new Error('Not enough balance. Nothing was sent.');
      const confirmedReceipt = await onSubmit(review);
      if (!mounted.current) return;
      if (!confirmedReceipt?.reference || confirmedReceipt.demo)
        throw new Error('The backend did not confirm this transfer. Check history before retrying.');
      succeeded = true;
      setStatus('confirmed');
      showToast({ kind: 'success', title: demo ? 'Demo send confirmed' : 'Send confirmed', body: 'Your receipt is ready.' });
      const receipt: SendReceiptData = confirmedReceipt;
      receiptTimer.current = setTimeout(() => {
        if (mounted.current) onReceipt(receipt);
      }, 650);
    } catch (cause) {
      if (mounted.current) {
        const message = cause instanceof Error ? cause.message : 'Sending failed. Please try again.';
        setError(message);
        showToast({ kind: 'error', title: 'Could not send', body: message });
        setAttempt(value => value + 1);
      }
    } finally {
      submitting.current = false;
      if (!succeeded) {
        lock.current = false;
        if (mounted.current) setStatus('idle');
      }
    }
  };

  const submit = async () => {
    if (isSend && !recipient) setTouched((t) => ({ ...t, [method]: true }));
    if (!valid || !target || pending || submitting.current) return;
    if (isSend && recipient) {
      Keyboard.dismiss();
      setError(null);
      setReview({ recipient: { ...recipient }, amount: cents / 100, note: '' });
      onReviewChange(true);
      return;
    }
    submitting.current = true;
    lock.current = true;
    Keyboard.dismiss();
    setStatus('pending');
    setError(null);
    try {
      if (isSend && recipient) await onSubmit({ recipient, amount: cents / 100, note: '' });
      else if (contact) await onSubmit({ contact, amount: cents / 100, note: '' });
      if (mounted.current) {
        setDone({ amount: cents / 100, name: target });
        showToast({ kind: 'success', title: 'Request created', body: 'Your payment request is ready.' });
      }
    } catch (e) {
      if (mounted.current) {
        const message = e instanceof Error && e.message ? e.message : 'Something went wrong. Please try again.';
        setError(message);
        showToast({ kind: 'error', title: 'Could not create request', body: message });
      }
    } finally {
      submitting.current = false;
      lock.current = false;
      if (mounted.current) setStatus('idle');
    }
  };

  if (done) return <Success isSend={isSend} demo={demo} text={isSend ? `${m.full(done.amount)} to ${done.name}` : `${done.name} was asked for ${m.full(done.amount)}`} onClose={onClose} />;
  if (review && reviewOpen) return <SendConfirmation draft={review} money={m} status={status} error={error} attempt={attempt} demo={demo} onConfirm={() => { void confirmSend(); }} />;

  const shown = showRaw(raw, m);
  const size = shown.length > 11 ? 34 : shown.length > 8 ? 44 : 56;
  const label = isSend ? 'Send'
    : pending ? 'Requesting…'
    : !target ? 'Choose a recipient'
      : cents === 0 ? 'Enter an amount'
        : over ? 'Not enough balance'
          : `Request ${m.full(cents / 100)} from ${target}`;

  return (
    <View style={styles.wrap}>
      {isSend ? (
        <View style={styles.recipient}>
          <View accessibilityRole="radiogroup" accessibilityLabel="Send by" style={styles.methods}>
            {METHODS.map((x) => {
              const on = x.id === method;
              return (
                <Pressable
                  key={x.id}
                  accessibilityRole="radio"
                  accessibilityLabel={`Send by ${x.label}`}
                  accessibilityState={{ selected: on, checked: on, disabled: pending }}
                  testID={`wallet-send-method-${x.id}`}
                  disabled={pending}
                  onPress={() => { setMethod(x.id); setError(null); }}
                  style={({ pressed }) => [
                    styles.method,
                    pending && { opacity: 0.4 },
                    pressed && { transform: [{ scale: 0.96 }] },
                  ]}
                >
                  <View style={[styles.ring, { borderColor: on ? x.ink : 'transparent' }]}>
                    <View style={[styles.methodCircle, { backgroundColor: c[x.tint] }]}>
                      <Feather name={x.icon} size={24} color={x.ink} />
                    </View>
                  </View>
                  <Text numberOfLines={1} style={[styles.methodText, { color: on ? c.walletInk : c.walletSubtle, fontFamily: on ? 'DMSans_600SemiBold' : 'DMSans_500Medium' }]}>
                    {x.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <LockInput
            key={method}
            value={draft}
            maxLength={method === 'email' ? 254 : method === 'username' ? 33 : 128}
            onChangeText={(v) => { setError(null); setDrafts((d) => ({ ...d, [method]: v })); }}
            onBlur={() => { if (draft.length) setTouched((t) => ({ ...t, [method]: true })); }}
            placeholder={meta.placeholder}
            keyboardType={meta.keyboard}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            autoComplete={method === 'email' ? 'email' : 'off'}
            textContentType={method === 'email' ? 'emailAddress' : method === 'username' ? 'username' : 'none'}
            inputMode={method === 'email' ? 'email' : 'text'}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
            disabled={pending}
            leftIcon={<Feather name={meta.icon} size={16} color={c.walletSubtle} />}
            description={meta.help}
            error={showRecipErr ?? undefined}
            accessibilityLabel={`Recipient ${meta.label}`}
            testID={`wallet-send-recipient-${method}`}
          />
        </View>
      ) : (
      <View accessibilityRole="radiogroup" accessibilityLabel="Choose a contact" style={styles.contacts}>
        {contacts.slice(0, MAX_VISIBLE_CONTACTS).map((x) => {
          const on = x.id === contactId;
          return (
            <ScalePressable
              key={x.id}
              accessibilityRole="radio"
              accessibilityState={{ selected: on, disabled: pending }}
              accessibilityLabel={`${isSend ? 'Send to' : 'Request from'} ${x.name}`}
              testID={`wallet-${mode}-contact-${x.id}`}
              disabled={pending}
              onPress={() => setContactId(x.id)}
              scaleTo={0.95}
              style={styles.contact}
            >
              <View
                style={[
                  styles.ring,
                  { borderColor: on ? c.walletInk : 'transparent', opacity: on || !contactId ? 1 : 0.55 },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: x.tint }]}>
                  <Face src={x.avatar} size={52} />
                </View>
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.contactName,
                  { color: on ? c.walletInk : c.walletSubtle, fontFamily: on ? 'DMSans_500Medium' : 'DMSans_400Regular' },
                ]}
              >
                {x.name}
              </Text>
            </ScalePressable>
          );
        })}
      </View>
      )}

      <View style={styles.center} accessible accessibilityLabel={`Amount ${m.symbol}${shown}`} testID={`wallet-${mode}-amount`}>
        <View style={styles.amountRow}>
          <Text style={[styles.amount, { fontSize: size, color: c.walletDisabled }]}>{m.symbol}</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[styles.amount, { fontSize: size, color: raw ? c.walletInk : c.walletDisabled }]}
          >
            {shown}
          </Text>
        </View>
        <Text
          accessibilityRole={over ? 'alert' : undefined}
          style={[styles.hint, { color: over ? c.walletError : c.walletMuted }]}
        >
          {over
            ? "That's more than your balance"
            : isSend
              ? `Balance ${m.full(balance)}`
              : contact
                ? `Requesting from ${contact.name}`
                : 'Choose who to request from'}
        </Text>
      </View>

      <NumericKeypad
        disabled={pending}
        decimal={m.decimal}
        onKey={(k) => { setError(null); setRaw((r) => press(r, k)); }}
        onClear={() => setRaw('')}
      />

      <View style={styles.errorBox} accessibilityLiveRegion="polite">
        {error && (
          <Text accessibilityRole="alert" style={[styles.error, { color: c.walletError }]}>
            {error}
          </Text>
        )}
      </View>

      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !valid || pending, busy: pending }}
        testID={`wallet-${mode}-submit`}
        disabled={!valid || pending}
        onPress={submit}
        scaleTo={0.98}
        style={[styles.cta, { backgroundColor: valid || pending ? c.walletInk : c.walletDisabled }]}
      >
        {pending && <ActivityIndicator size="small" color={c.walletOnInk} />}
        <Text
          numberOfLines={1}
          style={[styles.ctaText, { color: valid || pending ? c.walletOnInk : c.walletDisabledInk }]}
        >
          {label}
        </Text>
      </ScalePressable>

      {!isSend && !!paymentLink && <CopyLink link={paymentLink} testID="wallet-request-copy-link" />}
    </View>
  );
}

function Success({ isSend, demo, text, onClose }: { isSend: boolean; demo?: boolean; text: string; onClose: () => void }) {
  const c = useColors();
  const s = useRef(new Animated.Value(0.6)).current;
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(s, { toValue: 1, useNativeDriver: true, bounciness: 12, speed: 14 }),
      Animated.timing(o, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [s, o]);
  const title = isSend ? (demo ? 'Demo money sent' : 'Money sent') : demo ? 'Demo request sent' : 'Request sent';
  return (
    <View style={styles.success}>
      <Animated.View style={[styles.check, { backgroundColor: c.walletPositiveSoft, opacity: o, transform: [{ scale: s }] }]}>
        <Feather name="check" size={40} color={c.walletPositive} />
      </Animated.View>
      <Text accessibilityRole="alert" style={[styles.successTitle, { color: c.walletInk }]}>
        {title}
      </Text>
      <Text style={[styles.successText, { color: c.walletSubtle }]}>{text}</Text>
      {demo && (
        <Text style={[styles.demoNote, { color: c.walletDemoInk, backgroundColor: c.walletDemo }]}>
          {isSend ? 'Demo mode: only this screen changed. No real money moved.' : 'Demo mode: no request was delivered and nothing was credited.'}
        </Text>
      )}
      <ScalePressable
        accessibilityRole="button"
        accessibilityLabel="Done"
        testID="wallet-transfer-done"
        onPress={onClose}
        scaleTo={0.98}
        style={[styles.cta, { marginTop: 28, alignSelf: 'stretch', backgroundColor: c.walletInk }]}
      >
        <Text style={[styles.ctaText, { color: c.walletOnInk }]}>Done</Text>
      </ScalePressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14, paddingTop: 4 },
  recipient: { gap: 12 },
  methods: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  method: { width: 80, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4, borderRadius: 12 },
  methodCircle: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  methodText: { fontSize: 13, textAlign: 'center', maxWidth: 80 },
  contacts: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  contact: { width: 60, alignItems: 'center', gap: 6, paddingVertical: 4 },
  ring: { borderWidth: 2, borderRadius: 32, padding: 2 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  contactName: { fontSize: 12, maxWidth: 60 },
  center: { alignItems: 'center' },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8, maxWidth: '100%' },
  amount: { fontFamily: 'DMSans_600SemiBold', letterSpacing: -1.2, fontVariant: ['tabular-nums'], flexShrink: 1 },
  hint: { marginTop: 4, minHeight: 20, fontSize: 13, fontFamily: 'DMSans_400Regular' },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: { width: '31.6%', flexGrow: 1, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 22, fontFamily: 'DMSans_500Medium', fontVariant: ['tabular-nums'] },
  errorBox: { minHeight: 20, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 13, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
  cta: {
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  ctaText: { fontSize: 17, fontFamily: 'DMSans_600SemiBold', flexShrink: 1 },
  success: { alignItems: 'center', paddingHorizontal: 8, paddingTop: 24, paddingBottom: 8 },
  check: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  successTitle: { marginTop: 20, fontSize: 22, fontFamily: 'DMSans_600SemiBold', letterSpacing: -0.4 },
  successText: { marginTop: 4, fontSize: 15, fontFamily: 'DMSans_400Regular', textAlign: 'center' },
  demoNote: {
    marginTop: 14,
    fontSize: 13,
    fontFamily: 'DMSans_500Medium',
    textAlign: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
