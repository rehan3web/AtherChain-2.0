import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { onSessionExpired } from '@/services/api';
import { onBackendRefresh } from '@/services/refresh';
import { cachedRead, getCached, invalidateCache, scopesOverlap, type CachePolicy } from '@/services/cache';

/** Cache-first on navigation; explicit retry/pull-to-refresh bypasses both cache layers. */
export function useBackendResource<T>(loader: () => Promise<T>, policy?: CachePolicy) {
  const currentLoader = useRef(loader);
  currentLoader.current = loader;
  const mounted = useRef(true), focused = useRef(false), generation = useRef(0);
  const activePolicy = useRef(policy); activePolicy.current = policy;
  const initial = policy ? getCached<T>(`screen:${policy.key}`, policy.ttl) : undefined;
  const [data, setData] = useState<T | null>(() => initial?.value ?? null);
  const currentData = useRef(data); currentData.current = data;
  const [loading, setLoading] = useState(!initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<Promise<T | null> | null>(null);
  const reload = useCallback((options: { force?: boolean; onlyIfFocused?: boolean } = {}): Promise<T | null> => {
    if (options.onlyIfFocused && !focused.current) return Promise.resolve(null);
    if (pending.current) return pending.current;
    const run = ++generation.current, config = activePolicy.current;
    const force = options.force !== false;
    if (force && config) invalidateCache(config.tags);
    const hit = !force && config ? getCached<T>(`screen:${config.key}`, config.ttl) : undefined;
    if (mounted.current) {
      setLoading(!hit && (currentData.current === null || config?.blockWhileFetching === true));
      setRefreshing(!hit);
      setError(null);
    }
    const task = (config
      ? cachedRead(`screen:${config.key}`, () => currentLoader.current(), { ...config, force })
      : Promise.resolve().then(() => currentLoader.current()))
      .then(result => {
        if (mounted.current && run === generation.current) { currentData.current = result; setData(result); }
        return result;
      }).catch(cause => {
        if (mounted.current && run === generation.current)
          setError(cause instanceof Error ? cause.message : 'Could not load backend data.');
        return null;
      }).finally(() => {
        if (pending.current === task) pending.current = null;
        if (mounted.current && run === generation.current) { setLoading(false); setRefreshing(false); }
      });
    pending.current = task;
    return task;
  }, []);
  useEffect(() => {
    mounted.current = true;
    const expired = onSessionExpired(() => {
      generation.current++; pending.current = null; currentData.current = null;
      setData(null); setError(null); setLoading(false); setRefreshing(false);
    });
    const refreshed = onBackendRefresh(scope => {
      const config = activePolicy.current;
      if (!focused.current || config?.refreshOnMutation === false || (config && !scopesOverlap(config.tags, scope))) return;
      // A previous read may have started before the server mutation.
      generation.current++; pending.current = null;
      void reload({ force: false });
    });
    return () => { mounted.current = false; generation.current++; expired(); refreshed(); };
  }, [reload]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    void reload({ force: false });
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && activePolicy.current?.refreshOnAppActive !== false) void reload({ force: false });
    });
    return () => {
      focused.current = false; generation.current++; pending.current = null;
      subscription.remove();
    };
  }, [reload]));
  return { data, loading, refreshing, error, reload };
}
