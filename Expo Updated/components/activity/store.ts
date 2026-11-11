import { useSyncExternalStore } from 'react';
import type { SendReceiptData } from '@/components/wallet/SendReceipt';
import type { SwapReceiptData } from '@/components/wallet/swap-model';
import { transactionReceipt } from '@/components/wallet/transactionReceipt';

export type ActivityReceipt =
  | { type: 'send'; data: SendReceiptData; currency: 'USD' | 'AT' | 'ATH' }
  | { type: 'swap'; data: SwapReceiptData };

export type Activity = {
  id: string;
  title: string;
  timestamp: number;
  icon: 'arrow-up-right' | 'download' | 'zap' | 'repeat';
  value: string;
  positive?: boolean;
  preview?: boolean;
  isSample?: boolean;
  receipt?: ActivityReceipt;
};

// Share the existing sample wallet payment rather than inventing mining claims.
const sampleDate = new Date();
sampleDate.setMonth(0, 17);
sampleDate.setHours(20, 12, 0, 0);
export const SAMPLE_PAYMENT = { id: 't0', title: 'Dribbble Pro', timestamp: sampleDate.getTime(), amount: -60 };

// Like demo wallet transfers and boosts, this feed is scoped to the app session.
let activities: readonly Activity[] = [{
  id: SAMPLE_PAYMENT.id,
  isSample: true,
  title: SAMPLE_PAYMENT.title,
  timestamp: SAMPLE_PAYMENT.timestamp,
  icon: 'arrow-up-right',
  value: '−$60.00',
  receipt: {
    type: 'send', currency: 'USD',
    data: transactionReceipt({ ...SAMPLE_PAYMENT, date: SAMPLE_PAYMENT.timestamp }, 'en-US'),
  },
}];
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getSnapshot = () => activities;

export function recordActivity(activity: Activity) {
  if (activities.some(item => item.id === activity.id)) return;
  activities = [activity, ...activities]
    .sort((a, b) => b.timestamp - a.timestamp);
  listeners.forEach(listener => listener());
}

export function useRecentActivities() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useTransactionActivities(): readonly (Activity & { receipt: ActivityReceipt })[] {
  return useRecentActivities().filter((item): item is Activity & { receipt: ActivityReceipt } => !!item.receipt);
}
