import React, { useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { MoneyCard } from './MoneyCard';
import { recipientError } from './recipient';
import type { TransferRequest } from './types';
import type { SendReceiptData } from './SendReceipt';
import { router } from 'expo-router';
import { walletApi, ApiError } from '@/services/api';
import { getAllTransactions, walletTransaction } from '@/services/transactions';
import { useBackendResource } from '@/hooks/useBackendResource';
import { refreshBackendData } from '@/services/refresh';
import { useToast } from '@/components/toast/ToastProvider';
import { BackendScreenState } from '@/components/BackendScreenState';

export function Wallet({ style, fullScreen = false }: { style?: StyleProp<ViewStyle>; fullScreen?: boolean } = {}) {
  const { showToast } = useToast();
  const sending = useRef(false);
  const resource = useBackendResource(async () => {
    const [stats, transactions] = await Promise.all([walletApi.stats(), getAllTransactions()]);
    if (!Number.isFinite(Number(stats.ath_balance))) throw new Error('The backend returned an invalid wallet balance.');
    return { stats, transactions: transactions.filter(tx => ['send', 'receive', 'transfer'].includes(tx.type)).map(walletTransaction) };
  });
  useEffect(() => {
    if (resource.error) showToast({ kind: 'error', title: 'Wallet unavailable', body: resource.error });
  }, [resource.error, showToast]);
  const onSend = async (req: TransferRequest): Promise<SendReceiptData> => {
    if (sending.current) throw new Error('A transfer is already in progress.');
    if (!resource.data) throw new Error('Your wallet has not loaded. Please retry.');
    if (!Number.isFinite(req.amount) || req.amount <= 0) throw new Error('Enter a valid amount.');
    if (!req.recipient) throw new Error('Enter the recipient email, username, or wallet address.');
    const error = recipientError(req.recipient.method, req.recipient.value);
    if (error) throw new Error(error);
    if (!resource.data.stats.is_transfer_enabled) throw new Error('Transfers are currently disabled for this account.');
    sending.current = true;
    let submitted = false;
    try {
      const identifier = req.recipient.method === 'username' ? req.recipient.value.replace(/^@/, '') : req.recipient.value;
      // Lookup supports email/username only. The send endpoint itself resolves internal wallet addresses.
      if (req.recipient.method !== 'address') await walletApi.lookup(identifier);
      submitted = true;
      const result = await walletApi.send(identifier, req.amount);
      refreshBackendData();
      if (!result.hash) throw new Error('The transfer response did not include a reference. Check history before retrying.');
      if (result.historyPending) showToast({ kind: 'success', title: 'Transfer completed', body: 'Your balance is updated. Transaction history is syncing.' });
      return {
        amount: req.amount, recipient: req.recipient, note: req.note,
        reference: result.hash, createdAt: new Date().toLocaleString('en-US'),
        demo: false, direction: 'sent', status: 'completed',
      };
    } catch (cause) {
      if (submitted && (!(cause instanceof ApiError) || cause.status >= 500 || cause.status < 400)) {
        refreshBackendData();
        throw new Error('The transfer result is unconfirmed. Retry the same recipient and amount to recover its receipt safely.');
      }
      throw cause;
    } finally { sending.current = false; }
  };
  if (!resource.data) return <BackendScreenState testID="wallet-loading" error={resource.loading ? null : resource.error}
    onRetry={() => { void resource.reload(); }} />;
  return (
    <MoneyCard
      demo={false}
      fullScreen={fullScreen}
      balance={Number(resource.data.stats.ath_balance)}
      contacts={[]}
      transactions={resource.data?.transactions ?? []}
      onSend={onSend}
      onViewAll={() => router.push('/transactions')}
      paymentLink={resource.data?.stats.wallet_address ?? ''}
      style={style}
    />
  );
}
