import { useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Storage = { getItem: (key: string) => Promise<string | null>; setItem: (key: string, value: string) => Promise<void> };
type DemoState = { ready: boolean; entered: boolean; error: string | null; pending: boolean };
const KEY = 'atherchain.practice-entry.v1';

/** This preference only selects an app screen. It is not authentication. */
export function createDemoSessionStore(storage: Storage) {
  let state: DemoState = { ready: false, entered: false, error: null, pending: false };
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
        const raw = await storage.getItem(KEY);
        if (raw !== null && raw !== 'entered' && raw !== 'welcome')
          throw new Error('Saved practice entry preference is invalid.');
        publish({ ready: true, entered: raw === 'entered', error: null });
      } catch {
        publish({ ready: false, entered: false, error: 'Could not load the app entry preference. Please retry.' });
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
        // Never persist names, credentials, identifiers, phone numbers or OTPs.
        await storage.setItem(KEY, entered ? 'entered' : 'welcome');
        publish({ entered, error: null });
      } catch {
        publish({ error: 'Could not save the app entry preference. Please retry.' });
        throw new Error('Could not save the app entry preference. Please retry.');
      } finally {
        publish({ pending: false });
      }
    })().finally(() => { mutation = null; });
    return mutation;
  };
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
export const logoutDemo = store.logout;
export function useDemoSession() {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useEffect(() => { void loadDemoSession(); }, []);
  return state;
}
