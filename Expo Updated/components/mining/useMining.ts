import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import { claimMining, initialMiningState, miningSnapshot, parseMiningState, savedClaimDays, type MiningState } from './model';
import { recordActivity } from '@/components/activity/store';

const STORAGE_KEY = 'demo-mining-cycle-v1';

/** Device-local simulation. Claim persistence must succeed before showing success. */
export function useMining() {
  const [state, setState] = useState<MiningState | null>(null);
  const [now, setNow] = useState(Date.now);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const mounted = useRef(true);
  const submitting = useRef(false);
  const focusedOnce = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const saved = raw === null ? initialMiningState(Date.now()) : parseMiningState(raw);
        if (raw === null) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
        if (!cancelled) {
          setState(saved);
          setNow(Date.now());
        }
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load your saved demo mining progress.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [attempt]);

  useFocusEffect(useCallback(() => {
    // Dashboard and Mining read the same saved claims when returning to a tab.
    if (focusedOnce.current && !submitting.current) setAttempt(value => value + 1);
    focusedOnce.current = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const update = () => setNow(Date.now());
    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      stop();
      update();
      timer = setInterval(update, 1000);
    };
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') start();
    const listener = AppState.addEventListener('change', (status) => {
      if (status === 'active') start();
      else stop();
    });
    return () => { stop(); listener.remove(); };
  }, []));

  const claim = async (): Promise<{ ok: true; amount: number } | { ok: false; message: string } | null> => {
    if (!state || loading || submitting.current) return null;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const claimedAt = Date.now();
      const amount = miningSnapshot(state, claimedAt).pendingReward;
      const next = claimMining(state, claimedAt);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      recordActivity({
        id: `claim-${next.claims}-${claimedAt}`,
        title: 'Mining claimed',
        timestamp: claimedAt,
        icon: 'download',
        value: `+${amount.toLocaleString('en-US', { maximumFractionDigits: 6 })} AT`,
        positive: true,
        receipt: {
          type: 'send', currency: 'AT',
          data: {
            amount, recipient: { method: 'username', value: 'AtherChain mining' },
            note: '', reference: `demo-claim-${next.claims}-${claimedAt}`,
            createdAt: new Date(claimedAt).toLocaleString('en-US'),
            demo: true, direction: 'received', transactionTitle: 'Mining claimed', methodLabel: 'Mining reward',
          },
        },
      });
      if (mounted.current) {
        setState(next);
        setNow(Date.now());
        return { ok: true, amount };
      }
      return null;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not save your demo claim. Please retry.';
      if (mounted.current) {
        setError(message);
        return { ok: false, message };
      }
      return null;
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return {
    loading,
    busy,
    error,
    snapshot: state ? miningSnapshot(state, now) : null,
    claimDays: state ? savedClaimDays(state) : [],
    claim,
    retry: () => { if (!submitting.current) setAttempt((value) => value + 1); },
  };
}
