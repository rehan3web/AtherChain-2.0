import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

export type Passkey = {
  id: string;
  device: string;
  platform: 'android' | 'ios' | 'web' | 'other';
  createdAt: string;
};

// Practice records only. No device credentials are registered or persisted.
export function createPasskeyStore(platform: Passkey['platform']) {
  let passkeys: readonly Passkey[] = [];
  let sequence = 0;
  const listeners = new Set<() => void>();
  const publish = (next: readonly Passkey[]) => {
    passkeys = next;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => passkeys,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    createPasskey: (): Passkey => {
      const number = ++sequence;
      const device = platform === 'android' ? 'Android' : platform === 'ios' ? 'iOS device' : platform === 'web' ? 'Web browser' : 'This device';
      const passkey: Passkey = {
        id: `practice-passkey-${number}`,
        device: `${device} · Passkey ${number}`,
        platform,
        createdAt: new Date().toISOString(),
      };
      publish([...passkeys, passkey]);
      return passkey;
    },
    deletePasskey: (id: string) => {
      if (!passkeys.some(passkey => passkey.id === id)) return false;
      publish(passkeys.filter(passkey => passkey.id !== id));
      return true;
    },
  };
}

const platform: Passkey['platform'] =
  Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'other';
const store = createPasskeyStore(platform);

export function usePasskeys() {
  const passkeys = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { passkeys, createPasskey: store.createPasskey, deletePasskey: store.deletePasskey };
}
