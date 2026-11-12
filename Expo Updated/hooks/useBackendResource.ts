import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { onSessionExpired } from '@/services/api';
import { onBackendRefresh } from '@/services/refresh';

/** Existing screens retain their own loading/error presentation. */
export function useBackendResource<T>(loader: () => Promise<T>) {
  const currentLoader = useRef(loader);
  currentLoader.current = loader;
  const mounted = useRef(true);
  const generation = useRef(0);
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    const run = ++generation.current;
    if (mounted.current) { setLoading(true); setError(null); }
    try {
      const result = await currentLoader.current();
      if (mounted.current && run === generation.current) setData(result);
      return result;
    } catch (cause) {
      if (mounted.current && run === generation.current) {
        setData(null);
        setError(cause instanceof Error ? cause.message : 'Could not load backend data.');
      }
      return null;
    } finally {
      if (mounted.current && run === generation.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const expired = onSessionExpired(() => {
      generation.current++;
      setData(null);
      setError(null);
      setLoading(false);
    });
    const refreshed = onBackendRefresh(() => { void reload(); });
    return () => {
      mounted.current = false;
      generation.current++;
      expired();
      refreshed();
    };
  }, [reload]);
  useFocusEffect(useCallback(() => {
    void reload();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void reload();
    });
    return () => { subscription.remove(); generation.current++; };
  }, [reload]));
  return { data, loading, error, reload };
}
