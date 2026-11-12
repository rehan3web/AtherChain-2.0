import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken, setToken, clearToken, onSessionExpired, authApi, userApi, ApiError } from '@/services/api';

type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
type DemoState = { ready: boolean; entered: boolean; blocked: boolean; error: string | null; pending: boolean };

/** Keep the existing navigation interface, but gate it on a verified server session. */
export function createDemoSessionStore(storage: Storage) {
  let state: DemoState = { ready: false, entered: false, blocked: false, error: null, pending: false };
  let loading: Promise<void> | null = null;
  let mutation: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<DemoState>) => {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  };
  const load = (): Promise<void> => {
    if (loading) return loading;
    if (state.ready && !state.error) return Promise.resolve();
    publish({ pending: true, error: null });
    loading = (async () => {
      try {
        const token = await getToken();
        if (token) await userApi.me();
        publish({ ready: true, entered: !!token, error: null });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          publish({ ready: true, entered: false, error: null });
        } else if (error instanceof ApiError && error.data.code === 'USER_BLOCKED') {
          publish({ ready: true, entered: false, blocked: true, error: null });
        } else {
          publish({ ready: false, entered: false, error: error instanceof Error ? error.message : 'Could not verify your session. Please retry.' });
        }
      } finally {
        loading = null;
        publish({ pending: false });
      }
    })();
    return loading;
  };
  const setEntered = (entered: boolean): Promise<void> => {
    if (mutation) return mutation;
    mutation = (async () => {
      await load();
      if (!state.ready) throw new Error(state.error ?? 'App entry preference is not ready.');
      publish({ pending: true, error: null });
      try {
        if (entered) {
          if (!await getToken()) throw new Error('Please sign in to continue.');
          await userApi.me();
        } else {
          const result = await authApi.getSessions();
          const current = result.sessions?.find((session: { isCurrent: boolean }) => session.isCurrent);
          if (current) await authApi.removeSession(current.id);
          await clearToken();
        }
        publish({ entered, blocked: false, error: null });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not update your session. Please retry.';
        publish({ error: message });
        throw error;
      } finally {
        publish({ pending: false });
      }
    })().finally(() => { mutation = null; });
    return mutation;
  };
  onSessionExpired(reason => publish({ ready: true, entered: false, blocked: reason === 'blocked', error: null }));
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load,
    enter: () => setEntered(true),
    logout: () => setEntered(false),
  };
}

const store = createDemoSessionStore(AsyncStorage);
export const loadDemoSession = store.load;
export const enterDemo = store.enter;
export async function completeLogin(token: string) {
  await setToken(token);
  await store.enter();
}
export const logoutDemo = store.logout;
export function useDemoSession() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { void loadDemoSession(); }, []);
  return state;
}
