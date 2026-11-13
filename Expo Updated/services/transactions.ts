import { transactionApi } from './api';
import type { Transaction } from '@/components/wallet/types';
import type { SendReceiptData } from '@/components/wallet/SendReceipt';
import { normalizeRecipient, recipientError } from '@/components/wallet/recipient';
import type { TransferRecipient } from '@/components/wallet/types';

export type BackendTransaction = {
  id: string; timestamp: string; txHash: string; type: string; amount: string;
  status: string; fromAddress?: string; toAddress?: string;
  fee?: string; metadata?: Record<string, any>;
};

export async function getAllTransactions(): Promise<BackendTransaction[]> {
  const transactions: BackendTransaction[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const result = await transactionApi.list(page, 100);
    if (!Array.isArray(result.data) || !Number.isFinite(Number(result.meta?.totalPages)))
      throw new Error('The backend returned an invalid transaction history.');
    transactions.push(...result.data);
    totalPages = Number(result.meta.totalPages);
    page++;
  } while (page <= totalPages);
  return transactions;
}

function savedIdentity(value: any): TransferRecipient | undefined {
  return value && ['username', 'email', 'address'].includes(value.method) &&
    typeof value.value === 'string' && !recipientError(value.method, value.value)
    ? normalizeRecipient(value.method, value.value) : undefined;
}

export function walletTransaction(item: BackendTransaction): Transaction {
  const incoming = ['receive', 'mining', 'referral', 'claim'].includes(item.type);
  const amount = Number(item.amount);
  const date = new Date(item.timestamp);
  if (!Number.isFinite(amount) || !Number.isFinite(date.getTime()))
    throw new Error('The backend returned an invalid transaction amount or date.');
  const savedRecipient = savedIdentity(item.metadata?.recipient);
  const receivedRecipient = item.type === 'receive' ? savedRecipient : undefined;
  const recipient: TransferRecipient = incoming
    ? (receivedRecipient ? savedIdentity(item.metadata?.sender) : undefined)
      ?? { method: 'address', value: item.fromAddress ?? '' }
    : savedRecipient ?? { method: 'address', value: item.toAddress ?? '' };
  return {
    id: String(item.id), title: item.type === 'mining' ? 'Mining claimed'
      : item.type === 'swap' ? 'AT to ATH' : incoming ? 'Received' : 'Sent',
    amount: incoming ? amount : -amount, date,
    recipient,
    receivedRecipient,
    reference: item.txHash, status: item.status,
    currency: item.type === 'mining' || item.type === 'referral' ? 'AT' : 'ATH',
  };
}

export function backendReceipt(item: BackendTransaction): SendReceiptData {
  const transaction = walletTransaction(item);
  return {
    amount: Math.abs(transaction.amount),
    recipient: transaction.recipient!,
    receivedRecipient: transaction.receivedRecipient,
    note: '', reference: item.txHash || String(item.id),
    createdAt: new Date(item.timestamp).toLocaleString('en-US'),
    demo: false, direction: transaction.amount >= 0 ? 'received' : 'sent',
    transactionTitle: transaction.title,
    methodLabel: ['send', 'receive', 'transfer'].includes(item.type) ? undefined : item.type,
    status: item.status,
  };
}
