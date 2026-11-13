import { notificationApi } from '@/services/api';
import { useBackendResource } from '@/hooks/useBackendResource';
import { CACHE_POLICIES } from '@/services/cache';

export type NotificationItem = {
  id: string; title: string; body: string; createdAt: string; read: boolean;
  kind: 'info' | 'security' | 'updates';
};
export function useNotifications() {
  const resource = useBackendResource<NotificationItem[]>(async () => {
    const data = await notificationApi.list();
    if (!Array.isArray(data)) throw new Error('The backend returned an invalid notification list.');
    return data.map(item => ({
      id: String(item.id), title: item.title, body: item.message ?? item.body,
      createdAt: item.created_at, read: !!item.read,
      kind: item.category === 'security' ? 'security' : item.category === 'updates' ? 'updates' : 'info',
    }));
  }, CACHE_POLICIES.notifications);
  const notifications = resource.data ?? [];
  return {
    notifications, unreadCount: notifications.filter(item => !item.read).length,
    error: resource.error, loading: resource.loading, reload: resource.reload,
    markRead: async (id: string) => {
      await notificationApi.markAsRead(id);
      await resource.reload();
      return true;
    },
    markAllRead: async () => {
      const unread = notifications.filter(item => !item.read);
      const results = await Promise.allSettled(unread.map(item => notificationApi.markAsRead(item.id)));
      await resource.reload();
      const failed = results.find(result => result.status === 'rejected');
      if (failed?.status === 'rejected') throw failed.reason;
      return unread.length;
    },
  };
}
