import React, { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { DEFAULT_CONTACTS, DEFAULT_USER } from './defaults';
import { formatReceiptAmount, makeMoney, uid } from './format';
import { BallIcon } from './primitives';
import { MoneyCard } from './MoneyCard';
import { recipientError } from './recipient';
import type { Transaction, TransferRequest } from './types';
import { recordActivity, SAMPLE_PAYMENT } from '@/components/activity/store';
import { transactionReceipt } from './transactionReceipt';
import { router } from 'expo-router';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round2 = (n: number) => Math.round(n * 100) / 100;
const walletMoney = makeMoney('en-US', 'ATH');

/** Ready-to-render demo. All state is in memory; no real money moves. */
export function Wallet({ style, fullScreen = false }: { style?: StyleProp<ViewStyle>; fullScreen?: boolean } = {}) {
  const [balance, setBalance] = useState(52002.5);
  const [txs, setTxs] = useState<Transaction[]>(() => [{
    id: SAMPLE_PAYMENT.id, title: SAMPLE_PAYMENT.title,
    date: new Date(SAMPLE_PAYMENT.timestamp), amount: SAMPLE_PAYMENT.amount, icon: <BallIcon />,
  }]);

  const onSend = async (req: TransferRequest) => {
    const { contact, recipient, amount } = req;
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid demo amount');
    if (recipient) {
      const error = recipientError(recipient.method, recipient.value);
      if (error) throw new Error(error);
    }
    await wait(900); // simulated latency
    if (amount > balance) throw new Error('Insufficient demo funds');
    setBalance((b) => round2(b - amount));
    const name = contact ? contact.name : recipient.value;
    const id = uid();
    const date = new Date();
    const transaction: Transaction = {
      id, title: `To ${name} (demo)`,
      recipient: recipient ? { ...recipient } : { method: 'username', value: name },
      icon: contact?.avatar, date, amount: -amount,
    };
    const receipt = { ...transactionReceipt(transaction, 'en-US'), note: req.note };
    setTxs((p) => [transaction, ...p]);
    recordActivity({
      id, title: transaction.title, timestamp: date.getTime(), icon: 'arrow-up-right',
      value: `−${formatReceiptAmount(walletMoney, amount)}`,
      receipt: { type: 'send', data: receipt, currency: 'ATH' },
    });
    return receipt;
  };

  // A request is only a request: nothing is credited.
  const onRequest = async (_req: TransferRequest) => {
    await wait(700);
  };

  return (
    <MoneyCard
      demo
      fullScreen={fullScreen}
      user={DEFAULT_USER}
      balance={balance}
      contacts={DEFAULT_CONTACTS}
      transactions={txs}
      onSend={onSend}
      onRequest={onRequest}
      onViewAll={() => router.push('/transactions')}
      paymentLink="pay.example/ana"
      style={style}
    />
  );
}
