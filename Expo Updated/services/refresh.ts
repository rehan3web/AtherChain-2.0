import { invalidateCache, type CacheScope } from './cache';
const listeners = new Set<(scope: CacheScope) => void>();

/** Notify already-mounted screens after a confirmed server mutation. */
export function refreshBackendData(scope: CacheScope = 'all') {
  invalidateCache(scope);
  listeners.forEach(listener => listener(scope));
}

export function onBackendRefresh(listener: (scope: CacheScope) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
