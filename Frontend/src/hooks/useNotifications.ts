import useSWR from 'swr';
import api from '@/lib/api';

export interface Notification {
    id: number;
    title: string;
    message: string;
    created_at: string;
    read: boolean;
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export function useNotifications() {
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
    const shouldFetch = !pathname.startsWith('/admin');

    const { data, error, isLoading, mutate } = useSWR<Notification[]>(shouldFetch ? '/notifications' : null, fetcher, {
        refreshInterval: 30000, // Poll every 30 seconds
    });

    const markAsRead = async (id: number) => {
        try {
            await api.post(`/notifications/${id}/read`);
            // Optimistically update the UI
            mutate(
                (notifications) =>
                    notifications?.map((n) =>
                        n.id === id ? { ...n, read: true } : n
                    ),
                false
            );
        } catch (error) {
            console.error('Failed to mark notification as read', error);
        }
    };

    const unreadCount = data?.filter((n) => !n.read).length || 0;

    return {
        notifications: data || [],
        isLoading,
        isError: error,
        unreadCount,
        markAsRead,
        refreshInfo: mutate,
    };
}
