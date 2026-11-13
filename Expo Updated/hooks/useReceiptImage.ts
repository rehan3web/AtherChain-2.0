import { useRef, useState, type ComponentRef } from 'react';
import type { View } from 'react-native';
import { shareReceiptImage } from '@/services/receiptImage';
import { useToast } from '@/components/toast/ToastProvider';

export function useReceiptImage(filename: string) {
  const receiptRef = useRef<ComponentRef<typeof View>>(null);
  const locked = useRef(false);
  const [sharing, setSharing] = useState(false);
  const { showToast } = useToast();
  const shareImage = async () => {
    if (locked.current) return;
    locked.current = true;
    setSharing(true);
    try {
      if (!receiptRef.current) throw new Error('The receipt has not loaded. Please retry.');
      const outcome = await shareReceiptImage(receiptRef.current, filename);
      if (outcome === 'downloaded') showToast({ kind: 'success', title: 'Receipt image downloaded', body: 'Your browser does not support sharing image files directly. Share the downloaded PNG.' });
    } catch (cause) {
      showToast({ kind: 'error', title: 'Could not share receipt image', body: cause instanceof Error ? cause.message : 'Please retry.' });
    } finally {
      locked.current = false;
      setSharing(false);
    }
  };
  return { receiptRef, sharing, shareImage };
}
