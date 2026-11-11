import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

export type Session = {
  id: string;
  device: string;
  platform: 'android' | 'ios' | 'web' | 'other';
  startedAt: string;
  current: boolean;
};

// UI preview state only: these records are not authentication tokens or logins.
export function createSessionStore(initial: readonly Session[]) {
  let sessions: readonly Session[] = initial.map(session => ({ ...session }));
  const listeners = new Set<() => void>();
  const publish = (next: readonly Session[]) => {
    sessions = next;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => sessions,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    signOutSession: (id: string) => {
      if (!sessions.some(session => session.id === id)) return false;
      publish(sessions.filter(session => session.id !== id));
      return true;
    },
    signOutAll: () => {
      const count = sessions.length;
      if (count) publish([]);
      return count;
    },
  };
}

const platform: Session['platform'] =
  Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'other';
const device = platform === 'android' ? 'Android' : platform === 'ios' ? 'iOS device' : platform === 'web' ? 'Web browser' : 'This device';
const store = createSessionStore([{
  id: 'local-runtime',
  device,
  platform,
  startedAt: new Date().toISOString(),
  current: true,
}]);

export function useSessions() {
  const sessions = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { sessions, signOutSession: store.signOutSession, signOutAll: store.signOutAll };
}
