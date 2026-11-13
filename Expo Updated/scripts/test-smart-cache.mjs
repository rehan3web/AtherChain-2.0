import test from 'node:test';
import assert from 'node:assert/strict';
import { load, hooks, deferred } from './auth-test-utils.mjs';

const flush = () => new Promise(resolve => setImmediate(resolve));
function harness() {
  let now = 1_000_000, token = 'account-one', version = 1, failed = false, tokenGate;
  const calls = [], events = [];
  class Clock extends Date { static now() { return now; } }
  const cache = load('../services/cache.ts', {}, { Date: Clock });
  const refresh = load('../services/refresh.ts', { './cache': cache });
  refresh.onBackendRefresh(scope => events.push(scope));
  const api = load('../services/api.ts', {
    '@react-native-async-storage/async-storage': { getItem: async key => {
      const value = key === 'ather_token' ? token : null;
      if (tokenGate) await tokenGate.promise;
      return value;
    },
      setItem: async (_key, value) => { token = value; }, removeItem: async () => { token = null; } },
    'react-native': { Platform: { OS: 'web' } }, 'expo-secure-store': {}, 'expo-crypto': {},
    './financialRequests': { financialRequest: async (_token, _path, _body, send) => send('fixture-key') },
    './refresh': refresh, './cache': cache, '../constants/apiConfig': { getApiBaseUrl: () => '/api' },
  }, { AbortController, FormData, Date: Clock, Error, fetch: async (url, options) => {
    calls.push({ url, method: options.method, headers: options.headers });
    return { ok: !failed, status: failed ? 503 : 200,
      text: async () => JSON.stringify(failed ? { message: 'Unavailable' } : { version, token }) };
  } });
  return { cache, refresh, api, calls, events, pauseTokenRead() { tokenGate = deferred(); return tokenGate; },
    advance: ms => { now += ms; }, version: value => { version = value; }, fail: value => { failed = value; } };
}

test('stable profile uses long TTL; dashboard/statistics use a short TTL', async () => {
  const app = harness();
  await app.api.userApi.me(); await app.api.userApi.statistics();
  app.advance(19_000);
  await app.api.userApi.me(); await app.api.userApi.statistics();
  assert.equal(app.calls.length, 2);
  app.advance(2_000);
  await app.api.userApi.me(); await app.api.userApi.statistics();
  assert.equal(app.calls.length, 3);
  app.advance(15 * 60_000);
  await app.api.userApi.me();
  assert.equal(app.calls.length, 4);
});
test('concurrent identical reads are deduplicated; pagination and search remain distinct', async () => {
  const app = harness();
  await Promise.all([app.api.userApi.me(), app.api.userApi.me(), app.api.userApi.me()]);
  assert.equal(app.calls.length, 1);
  await app.api.transactionApi.list(1, 20, 'alice');
  await app.api.transactionApi.list(2, 20, 'alice');
  await app.api.transactionApi.list(1, 20, 'bob');
  await app.api.transactionApi.list(1, 20, 'alice');
  assert.equal(app.calls.length, 4);
});
test('financial profile consumers enforce short max-age, and security checks can force a fresh read', async () => {
  const app = harness();
  await app.api.userApi.me();
  app.advance(5_000); await app.api.userApi.me({ maxAge: 20_000 });
  assert.equal(app.calls.length, 1);
  app.advance(16_000); await app.api.userApi.me({ maxAge: 20_000 });
  assert.equal(app.calls.length, 2);
  await app.api.userApi.me({ force: true });
  assert.equal(app.calls.length, 3);
});
test('KYC status never persists in cache and TTL expiry itself performs no HTTP requests', async () => {
  const app = harness();
  await app.api.kycApi.status();
  app.advance(600_000); await flush();
  assert.equal(app.calls.length, 1);
  await app.api.kycApi.status();
  assert.equal(app.calls.length, 2);
});
test('successful writes invalidate only related data; read-like POSTs do not invalidate', async () => {
  const app = harness();
  await app.api.userApi.me(); await app.api.newsApi.list(); await app.api.walletApi.stats();
  await app.api.userApi.updateProfile({ firstName: 'Fixture' });
  await app.api.userApi.me(); await app.api.newsApi.list(); await app.api.walletApi.stats();
  assert.equal(app.calls.length, 5);
  const events = app.events.length;
  await app.api.walletApi.lookup('fixture_friend');
  await app.api.userApi.generate2FA();
  await app.api.userApi.me(); await app.api.walletApi.stats();
  assert.equal(app.events.length, events);
  assert.equal(app.calls.length, 7);
});
test('failed reads are not cached and failed writes do not destroy valid cached data', async () => {
  const app = harness();
  app.fail(true);
  await assert.rejects(app.api.userApi.me(), /Unavailable/);
  app.fail(false); await app.api.userApi.me();
  app.fail(true); await assert.rejects(app.api.userApi.updateProfile({}), /Unavailable/);
  app.fail(false); await app.api.userApi.me();
  assert.equal(app.calls.length, 3);
  assert.equal(app.events.length, 0);
});
test('logout and account changes clear cached private reads, without caching tokens', async () => {
  const app = harness();
  assert.equal((await app.api.userApi.me()).token, 'account-one');
  await app.api.setToken('account-two');
  assert.equal((await app.api.userApi.me()).token, 'account-two');
  assert.equal(app.calls.length, 2);
  await app.api.clearToken();
  await assert.rejects(app.api.userApi.me(), /sign in/i);
  assert.equal(app.calls.length, 2);
});
test('a token read racing an account change cannot send a request with the previous account token', async () => {
  const app = harness(), gate = app.pauseTokenRead();
  const response = app.api.userApi.me();
  await app.api.setToken('account-two');
  gate.resolve();
  await assert.rejects(response, /session changed/);
  assert.equal(app.calls.length, 0);
});
test('financial writes invalidate balances, totals and receipts, but leave unrelated content cached', async () => {
  const app = harness();
  const reads = () => Promise.all([app.api.walletApi.stats(), app.api.userApi.statistics(),
    app.api.transactionApi.list(), app.api.referralApi.stats(), app.api.newsApi.list()]);
  await reads();
  await app.api.request('/wallet/send', { method: 'POST', body: { recipient: 'fixture', amount: 1 } });
  await reads();
  assert.equal(app.calls.length, 10);
  assert.equal(app.calls.filter(call => call.url === '/api/news').length, 1);
});
test('invalidated in-flight responses cannot refill the cache or replace newer data', async () => {
  const { cache } = harness(), old = deferred(), fresh = deferred();
  const options = { ttl: 20_000, tags: ['profile'] };
  const first = cache.cachedRead('example', () => old.promise, options);
  cache.invalidateCache(['profile']);
  const next = cache.cachedRead('example', () => fresh.promise, options);
  fresh.resolve('new'); await next;
  old.resolve('old'); await first;
  assert.equal(cache.getCached('example', 20_000).value, 'new');
});
test('relative mining countdown snapshots expire at eligibility, without resetting their original timestamp', async () => {
  const app = harness(), snapshot = { receivedAt: 1_000_000, status: { timeLeft: 3 } };
  const policy = app.cache.CACHE_POLICIES.mining;
  await app.cache.cachedRead('screen:mining', async () => snapshot, policy);
  app.advance(2_000);
  assert.equal(app.cache.getCached('screen:mining', policy.ttl).value, snapshot);
  app.advance(1_001);
  assert.equal(app.cache.getCached('screen:mining', policy.ttl), undefined);
});
test('request caches have a bounded memory footprint', async () => {
  const { cache } = harness(), options = { ttl: 10_000, tags: ['news'] };
  for (let i = 0; i < 170; i++) await cache.cachedRead(`news-${i}`, async () => i, options);
  assert.equal(cache.getCached('news-0', options.ttl), undefined);
  assert.equal(cache.getCached('news-169', options.ttl).value, 169);
});

function resourceHarness(app, loader, policy) {
  const h = hooks();
  let onFocus, cleanup, appState, expired;
  const module = load('../hooks/useBackendResource.ts', {
    react: h.react, 'react-native': { AppState: { addEventListener: (_event, callback) => {
      appState = callback; return { remove() {} };
    } } },
    'expo-router': { useFocusEffect: callback => h.react.useEffect(() => {
      onFocus = callback; cleanup = callback(); return () => cleanup?.();
    }, []) },
    '@/services/api': { onSessionExpired: callback => { expired = callback; return () => {}; } },
    '@/services/refresh': app.refresh, '@/services/cache': app.cache,
  }, { Error });
  return { render: () => h.render(() => module.useBackendResource(loader, policy)),
    blur() { cleanup?.(); cleanup = null; }, focus() { cleanup = onFocus(); },
    active() { appState('active'); }, expire() { app.cache.invalidateCache(); expired(); }, unmount: h.unmount };
}
test('a fresh screen cache renders immediately on reopening, without an API call', async () => {
  const app = harness(), policy = app.cache.CACHE_POLICIES.profile;
  const first = resourceHarness(app, app.api.userApi.me, policy);
  assert.equal(first.render().loading, true); await flush();
  assert.equal(first.render().data.version, 1);
  first.unmount();
  const second = resourceHarness(app, app.api.userApi.me, policy);
  const cached = second.render();
  assert.equal(cached.loading, false); assert.equal(cached.data.version, 1);
  await flush(); assert.equal(app.calls.length, 1);
});
test('pull-to-refresh bypasses both screen and HTTP caches while preserving visible data', async () => {
  const app = harness(), hook = resourceHarness(app, app.api.userApi.me, app.cache.CACHE_POLICIES.profile);
  hook.render(); await flush(); app.version(2);
  const request = hook.render().reload();
  const pending = hook.render();
  assert.equal(pending.refreshing, true); assert.equal(pending.loading, false);
  assert.equal(pending.data.version, 1);
  await request;
  assert.equal(hook.render().data.version, 2);
  assert.equal(app.calls.length, 2);
});
test('hidden screens do not refetch on mutations, but refresh on reopening', async () => {
  const app = harness(), hook = resourceHarness(app, app.api.userApi.me, app.cache.CACHE_POLICIES.profile);
  hook.render(); await flush(); hook.blur();
  app.version(2); await app.api.userApi.updateProfile({});
  await flush(); assert.equal(app.calls.length, 2);
  hook.focus(); await flush();
  assert.equal(hook.render().data.version, 2);
  assert.equal(app.calls.length, 3);
});
test('KYC fetches once per opening, never on app resume, refresh events or elapsed time', async () => {
  const app = harness(), hook = resourceHarness(app, app.api.kycApi.status, app.cache.CACHE_POLICIES.kyc);
  hook.render(); await flush();
  app.advance(600_000); hook.active(); app.refresh.refreshBackendData(['kyc']); await flush();
  assert.equal(app.calls.length, 1);
  hook.blur(); hook.focus(); await flush();
  assert.equal(app.calls.length, 2);
});
test('unrelated mutations do not reload a focused screen', async () => {
  const app = harness(), hook = resourceHarness(app, () => app.api.newsApi.list(), app.cache.CACHE_POLICIES.news);
  hook.render(); await flush();
  await app.api.userApi.updateProfile({}); await flush();
  assert.equal(app.calls.length, 2);
  assert.equal(hook.render().error, null);
});
test('automatic countdown refresh skips hidden screens; explicit refresh still works', async () => {
  const app = harness(), hook = resourceHarness(app, app.api.userApi.me, app.cache.CACHE_POLICIES.profile);
  hook.render(); await flush(); hook.blur();
  await hook.render().reload({ onlyIfFocused: true });
  assert.equal(app.calls.length, 1);
});
test('session expiry clears visible state and ignores a late resource response', async () => {
  const app = harness(), response = deferred();
  const hook = resourceHarness(app, () => response.promise, app.cache.CACHE_POLICIES.profile);
  hook.render(); hook.expire(); response.resolve({ version: 1 }); await flush();
  assert.equal(hook.render().data, null);
  assert.equal(hook.render().loading, false);
});
