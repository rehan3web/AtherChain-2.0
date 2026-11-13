import { useEffect } from 'react';
import type { SendReceiptData } from '@/components/wallet/SendReceipt';
import type { SwapReceiptData } from '@/components/wallet/swap-model';
import { useBackendResource } from '@/hooks/useBackendResource';
import { useToast } from '@/components/toast/ToastProvider';
import { getAllTransactions, walletTransaction, backendReceipt } from '@/services/transactions';
import { refreshBackendData } from '@/services/refresh';
import { SWAP_COINS, swapQuote } from '@/components/wallet/swap-model';

export type ActivityReceipt =
  | { type: 'send'; data: SendReceiptData; currency: 'USD' | 'AT' | 'ATH' }
  | { type: 'swap'; data: SwapReceiptData };
export type Activity = {
  id: string; title: string; timestamp: number;
  icon: 'arrow-up-right' | 'download' | 'zap' | 'repeat';
  value: string; positive?: boolean; preview?: boolean; isSample?: boolean;
  status?: string;
  receipt?: ActivityReceipt;
};

/** Local notifications never manufacture transaction records. */
export function recordActivity(_activity: Activity) { refreshBackendData(); }

export function useActivityResource() {
  const { showToast } = useToast();
  const resource = useBackendResource<Activity[]>(async () => {
    const items = await getAllTransactions();
    return items.map(item => {
      const transaction = walletTransaction(item);
      const currency = transaction.currency ?? 'ATH';
      let receipt: ActivityReceipt = { type: 'send', data: backendReceipt(item), currency };
      if (item.type === 'swap' && item.status === 'completed' && item.metadata) {
        const [pay, receive] = SWAP_COINS;
        receipt = {
          type: 'swap',
          data: {
            reference: item.txHash, createdAt: new Date(item.timestamp).toLocaleString('en-US'),
            pay, receive,
            quote: swapQuote(pay, receive, Number(item.metadata.fromAmount), Number(item.metadata.rate)),
          },
        };
      }
      return {
        id: String(item.id), title: transaction.title, status: item.status,
        timestamp: new Date(item.timestamp).getTime(),
        icon: item.type === 'swap' ? 'repeat' : transaction.amount >= 0 ? 'download' : 'arrow-up-right',
        value: `${transaction.amount >= 0 ? '+' : '−'}${Math.abs(transaction.amount).toLocaleString('en-US', { maximumFractionDigits: 6 })} ${currency}`,
        positive: transaction.amount >= 0, receipt,
      };
    });
  });
  useEffect(() => { if (resource.error) showToast({ kind: 'error', title: 'Transaction history', body: resource.error }); }, [resource.error, showToast]);
  return resource;
}
export function useRecentActivities(): readonly Activity[] {
  return useActivityResource().data ?? [];
}
export function useTransactionActivityResource() {
  const resource = useActivityResource();
  return {
    ...resource,
    items: (resource.data ?? []).filter((item): item is Activity & { receipt: ActivityReceipt } => !!item.receipt),
  };
}
export function useTransactionActivities(): readonly (Activity & { receipt: ActivityReceipt })[] {
  return useRecentActivities().filter((item): item is Activity & { receipt: ActivityReceipt } => !!item.receipt);
}
