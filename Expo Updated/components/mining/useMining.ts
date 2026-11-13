import { useEffect, useRef, useState } from 'react';
import { miningApi, userApi } from '@/services/api';
import { useBackendResource } from '@/hooks/useBackendResource';
import { CACHE_POLICIES } from '@/services/cache';
import { refreshBackendData } from '@/services/refresh';
import { miningSnapshot } from './model';
import { getAllTransactions } from '@/services/transactions';

/** The server credits immediately, then controls the next eligible claim. */
export function useMining() {
  const resource = useBackendResource(async () => {
    const [status, profile, statistics, transactions] = await Promise.all([
      miningApi.status(), userApi.me({ maxAge: 20_000 }), userApi.statistics(), getAllTransactions(),
    ]);
    if (!Number.isFinite(Number(status.timeLeft)) || !Number.isFinite(Number(status.currentYield)))
      throw new Error('The backend returned invalid mining status.');
    const totalMined = transactions.filter(item => item.type === 'mining' && item.status === 'completed')
      .reduce((total, item) => total + Number(item.amount), 0);
    const data = { status, profile, statistics, totalMined, receivedAt: Date.now() };
    miningSnapshot(data, data.receivedAt);
    return data;
  }, CACHE_POLICIES.mining);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const data = resource.data;
  const remainingMs = data ? Math.max(0, Number(data.status.timeLeft) * 1000 - (now - data.receivedAt)) : 0;
  // Reaching zero on the device does not grant permission to claim.
  // Refresh the authoritative eligibility state instead.
  useEffect(() => {
    if (data && Number(data.status.timeLeft) > 0 && remainingMs === 0 && !resource.loading)
      void resource.reload({ onlyIfFocused: true });
  }, [data, remainingMs, resource.loading, resource.reload]);
  const snapshot = data ? miningSnapshot(data, now) : null;
  const claim = async (): Promise<{ ok: true; amount: number } | { ok: false; message: string } | null> => {
    if (!snapshot?.canClaim || submitting.current || resource.loading) return null;
    submitting.current = true;
    setBusy(true);
    setMutationError(null);
    try {
      await miningApi.validate();
      const result = await miningApi.start();
      if (!Number.isFinite(Number(result.reward))) throw new Error('The backend returned an invalid mining receipt. Refresh before retrying.');
      return { ok: true, amount: Number(result.reward) };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The mining request failed.';
      setMutationError(message);
      return { ok: false, message };
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const boost = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      const result = await miningApi.claimBoost();
      return result;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return {
    loading: resource.loading,
    refreshing: resource.refreshing,
    refresh: () => {
      setMutationError(null);
      // Refresh all visible dashboard/statistics sections, not only the mining card.
      refreshBackendData(CACHE_POLICIES.mining.tags);
      return resource.reload({ force: false });
    },
    busy,
    error: mutationError ?? resource.error,
    snapshot,
    claimDays: data?.statistics.miningCalendar?.map((day: { date: string }) => day.date) ?? [],
    boosts: Number(data?.status.currentCycleBoosts ?? 0),
    maxBoosts: Number(data?.status.maxBoosts ?? 0),
    boostEnabled: data?.status.boostEnabled === true,
    boost,
    claim,
    retry: () => { setMutationError(null); void resource.reload(); },
  };
}
