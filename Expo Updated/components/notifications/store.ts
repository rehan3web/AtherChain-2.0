import { useSyncExternalStore } from 'react';

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  kind: 'info' | 'security' | 'updates';
};

const SAMPLES: NotificationItem[] = [
  { id: 'welcome', title: 'Welcome to AtherChain', body: 'Explore your wallet, mining dashboard and account settings in this app preview.', createdAt: '2026-11-09T16:00:00Z', read: false, kind: 'info' },
  { id: 'security', title: 'Explore security settings', body: 'Try the 2FA, passkey and password practice flows. These previews do not change real account security.', createdAt: '2026-11-08T16:00:00Z', read: false, kind: 'security' },
  { id: 'support', title: 'Your support space', body: 'Create a practice ticket and keep a conversation history on this device.', createdAt: '2026-11-07T16:00:00Z', read: false, kind: 'info' },
  { id: 'updates', title: 'Stay up to date', body: 'Visit News from the dashboard to explore the latest sample community stories.', createdAt: '2026-11-06T16:00:00Z', read: true, kind: 'updates' },
];

/** Local sample inbox, shared across navigation. No push subscription or remote account. */
export function createNotificationsStore(initial: NotificationItem[] = SAMPLES) {
  let snapshot = initial.map(item => ({ ...item }));
  const listeners = new Set<() => void>();
  const publish = (next: NotificationItem[]) => {
    snapshot = next;
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    markRead: (id: string) => {
      if (!snapshot.some(item => item.id === id && !item.read)) return false;
      publish(snapshot.map(item => item.id === id ? { ...item, read: true } : item));
      return true;
    },
    markAllRead: () => {
      const count = snapshot.filter(item => !item.read).length;
      if (count) publish(snapshot.map(item => item.read ? item : { ...item, read: true }));
      return count;
    },
  };
}

const store = createNotificationsStore();

export function useNotifications() {
  const notifications = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return {
    notifications,
    unreadCount: notifications.filter(item => !item.read).length,
    markRead: store.markRead,
    markAllRead: store.markAllRead,
  };
}
