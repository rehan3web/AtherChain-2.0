/**
 * Session-only cache. Never persist KYC, balances, security settings or tokens.
 * TTL expiry is passive: it does not start timers or poll the backend.
 */
export type CacheTag = 'profile' | 'config' | 'stats' | 'mining' | 'wallet' | 'swap' |
  'transactions' | 'referral' | 'notifications' | 'security' | 'kyc' | 'support' | 'news';
export type CacheScope = readonly CacheTag[] | 'all';
export type CachePolicy = {
  key: string;
  ttl: number;
  tags: readonly CacheTag[];
  refreshOnAppActive?: boolean;
  refreshOnMutation?: boolean;
  blockWhileFetching?: boolean;
  expiresAt?: (value: unknown) => number;
};
const second = 1000, minute = 60 * second;
export const CACHE_POLICIES = {
  profile: { key: 'profile', ttl: 15 * minute, tags: ['profile'] },
  mining: { key: 'mining', ttl: 20 * second, tags: ['mining', 'profile', 'stats', 'transactions'],
    expiresAt: (value: unknown) => {
      const data = value as { receivedAt: number; status: { timeLeft: number } };
      return Number(data.status.timeLeft) > 0 ? data.receivedAt + Number(data.status.timeLeft) * second : Infinity;
    } },
  wallet: { key: 'wallet', ttl: 15 * second, tags: ['wallet', 'transactions'] },
  receive: { key: 'receive', ttl: 15 * second, tags: ['wallet'] },
  swap: { key: 'swap', ttl: 10 * second, tags: ['swap', 'profile', 'wallet'] },
  activity: { key: 'activity', ttl: 30 * second, tags: ['transactions'] },
  referral: { key: 'referral', ttl: minute, tags: ['referral'] },
  notifications: { key: 'notifications', ttl: 30 * second, tags: ['notifications'] },
  sessions: { key: 'sessions', ttl: 20 * second, tags: ['security'] },
  passkeys: { key: 'passkeys', ttl: 0, tags: ['security', 'profile'], blockWhileFetching: true },
  twofa: { key: 'twofa', ttl: 0, tags: ['security', 'profile'], blockWhileFetching: true },
  kyc: { key: 'kyc', ttl: 0, tags: ['kyc'], refreshOnAppActive: false, refreshOnMutation: false, blockWhileFetching: true },
  news: { key: 'news', ttl: 5 * minute, tags: ['news'] },
} as const satisfies Record<string, CachePolicy>;

type Entry = { value: unknown; savedAt: number; expiresAt: number; tags: readonly CacheTag[] };
type Flight = { promise: Promise<unknown>; tags: readonly CacheTag[] };
const entries = new Map<string, Entry>(), flights = new Map<string, Flight>();
const MAX_ENTRIES = 150;
export function scopesOverlap(tags: readonly CacheTag[], scope: CacheScope) {
  return scope === 'all' || tags.some(tag => scope.includes(tag));
}
export function invalidateCache(scope: CacheScope = 'all') {
  for (const [key, entry] of entries) if (scopesOverlap(entry.tags, scope)) entries.delete(key);
  // Detach old requests so their late responses cannot refill an invalidated cache.
  for (const [key, flight] of flights) if (scopesOverlap(flight.tags, scope)) flights.delete(key);
}
export function getCached<T>(key: string, ttl: number): { value: T } | undefined {
  const entry = entries.get(key);
  if (!entry || ttl <= 0 || Date.now() >= Math.min(entry.expiresAt, entry.savedAt + ttl)) return undefined;
  entries.delete(key); entries.set(key, entry);
  return { value: entry.value as T };
}
export function cachedRead<T>(key: string, loader: () => Promise<T>,
  options: { ttl: number; tags: readonly CacheTag[]; force?: boolean; expiresAt?: (value: unknown) => number }): Promise<T> {
  const hit = !options.force && getCached<T>(key, options.ttl);
  if (hit) return Promise.resolve(hit.value);
  const existing = flights.get(key);
  if (existing) return existing.promise as Promise<T>;
  const flight: Flight = { tags: options.tags, promise: Promise.resolve() };
  flight.promise = Promise.resolve().then(loader).then(value => {
    if (flights.get(key) === flight && options.ttl > 0) {
      entries.delete(key);
      entries.set(key, { value, savedAt: Date.now(),
        expiresAt: Math.min(Date.now() + options.ttl, options.expiresAt?.(value) ?? Infinity), tags: options.tags });
      while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    }
    return value;
  }).finally(() => { if (flights.get(key) === flight) flights.delete(key); });
  flights.set(key, flight);
  return flight.promise as Promise<T>;
}

/** Only these known read endpoints are cached. Unknown reads are not retained. */
export function requestPolicy(path: string): { ttl: number; tags: readonly CacheTag[] } {
  const route = path.split('?')[0];
  if (route === '/user/me') return { ttl: 15 * minute, tags: ['profile', 'security'] };
  if (route === '/user/kyc/status') return { ttl: 0, tags: ['kyc'] };
  if (route === '/user/kyc/config' || route.startsWith('/categories')) return { ttl: 60 * minute, tags: ['config'] };
  // timeLeft is relative to the response time. Never give a new timestamp to an old status.
  if (route === '/mining/status') return { ttl: 0, tags: ['mining'] };
  if (route.startsWith('/user/dashboard') || route === '/user/statistics') return { ttl: 20 * second, tags: ['stats'] };
  if (route === '/wallet/stats') return { ttl: 15 * second, tags: ['wallet'] };
  if (route.startsWith('/swap/')) return { ttl: 10 * second, tags: ['swap'] };
  if (route === '/transactions') return { ttl: 30 * second, tags: ['transactions'] };
  if (route === '/referral/stats') return { ttl: minute, tags: ['referral'] };
  if (route.startsWith('/notifications') || route.startsWith('/push-notifications/')) return { ttl: 30 * second, tags: ['notifications'] };
  if (route === '/auth/sessions') return { ttl: 20 * second, tags: ['security'] };
  if (route === '/support' || route.startsWith('/support/')) return { ttl: 30 * second, tags: ['support'] };
  if (route === '/news') return { ttl: 5 * minute, tags: ['news'] };
  return { ttl: 0, tags: [] };
}
export function mutationScope(path: string): CacheScope {
  if (['/wallet/send', '/swap/execute', '/mining/start', '/mining/claim-boost'].includes(path))
    return ['wallet', 'swap', 'mining', 'stats', 'transactions', 'profile', 'referral'];
  if (path.startsWith('/user/kyc/')) return ['kyc', 'profile'];
  if (['/user/2fa/verify', '/user/2fa/disable', '/user/passkey/register-verify', '/user/passkey/remove'].includes(path) ||
    path.startsWith('/auth/sessions') || path === '/user/password')
    return ['security', 'profile'];
  if (path.startsWith('/user/profile')) return ['profile'];
  if (path.startsWith('/notifications/') || path.startsWith('/push-notifications/')) return ['notifications'];
  if (path.startsWith('/support')) return ['support'];
  return [];
}
