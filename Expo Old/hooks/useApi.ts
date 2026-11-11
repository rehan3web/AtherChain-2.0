import { useCallback, useEffect, useRef, useState } from "react";

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useApi<T>(
  fetcher: () => Promise<T>,
  deps: any[] = []
): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      if (mountedRef.current) setData(result);
    } catch (err: any) {
      if (mountedRef.current) {
        setError(
          err?.response?.data?.message || err?.message || "Failed to load data"
        );
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps);

  useEffect(() => { run(); }, [run]);

  return { data, loading, error, refresh: run };
}
