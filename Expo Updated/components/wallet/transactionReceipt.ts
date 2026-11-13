import type { Transaction } from './types';
import type { SendReceiptData } from './SendReceipt';

/** A local preview only; opening history never submits a transfer. */
export function transactionReceipt(transaction: Transaction, locale: string): SendReceiptData {
  const date = new Date(transaction.date);
  return {
    amount: Math.abs(transaction.amount),
    recipient: transaction.recipient
      ? { ...transaction.recipient }
      : { method: 'username', value: transaction.title },
    receivedRecipient: transaction.receivedRecipient ? { ...transaction.receivedRecipient } : undefined,
    note: '',
    reference: transaction.reference ?? transaction.id,
    createdAt: Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString(locale),
    demo: false,
    status: transaction.status,
    direction: transaction.amount > 0 ? 'received' : 'sent',
    transactionTitle: transaction.title,
    methodLabel: transaction.recipient ? undefined : 'Wallet',
  };
}
