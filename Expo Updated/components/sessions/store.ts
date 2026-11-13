import { authApi, clearToken } from '@/services/api';
import { useBackendResource } from '@/hooks/useBackendResource';
import { CACHE_POLICIES } from '@/services/cache';

export type Session = {
  id: string; device: string; platform: 'android' | 'ios' | 'web' | 'other';
  startedAt: string; current: boolean;
};
export function useSessions() {
  const resource = useBackendResource<Session[]>(async () => {
    const data = await authApi.getSessions();
    if (!Array.isArray(data.sessions)) throw new Error('The backend returned an invalid session list.');
    return data.sessions.map((item: any) => ({
      id: String(item.id), device: item.device, startedAt: item.loginTime,
      current: item.isCurrent === true,
      platform: /android/i.test(item.device) ? 'android' : /iphone|ipad|ios/i.test(item.device) ? 'ios'
        : /mozilla|chrome|safari|web/i.test(item.device) ? 'web' : 'other',
    }));
  }, CACHE_POLICIES.sessions);
  const sessions = resource.data ?? [];
  return {
    sessions, error: resource.error, loading: resource.loading, reload: resource.reload,
    signOutSession: async (id: string) => {
      await authApi.removeSession(id);
      if (sessions.find(item => item.id === id)?.current) await clearToken();
      else await resource.reload();
      return true;
    },
    signOutAll: async () => {
      const count = sessions.length;
      await authApi.removeAllSessions();
      await clearToken();
      return count;
    },
  };
}
