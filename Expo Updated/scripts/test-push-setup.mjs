import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { hooks } from './auth-test-utils.mjs';

function load(path, deps, globals = {}) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, console: { error() {} }, process: { env: {} }, ...globals,
    require(name) { assert.ok(name in deps, `Unexpected dependency ${name}`); return deps[name]; } });
  return exports;
}
const token = 'ExponentPushToken[test_device]';

function backend(ticket, throws = false) {
  const sends = [], queries = [];
  const api = load('../../Backend/src/services/expoPush.ts', {
    axios: { post: async (...args) => { sends.push(args); if (throws) throw Error('offline'); return { data: { data: ticket } }; } },
    '../db/postgres': { query: async (...args) => { queries.push(args); } },
  });
  return { ...api, sends, queries };
}

test('both Expo token prefixes are accepted; malformed values never reach Expo', async () => {
  const api = backend({ status: 'ok', id: 'ticket' });
  assert.equal(api.isExpoPushToken(token), true);
  assert.equal(api.isExpoPushToken('ExpoPushToken[abc-123]'), true);
  for (const invalid of [null, {}, '', 'ExponentPushToken', 'https://example.com', 'ExpoPushToken[bad value]']) {
    assert.equal(api.isExpoPushToken(invalid), false);
    assert.equal(await api.sendExpoPush(invalid, 'title', 'body'), false);
  }
  assert.equal(api.sends.length, 0);
});
test('sender uses the Android channel and only accepts a valid Expo ticket', async () => {
  const api = backend({ status: 'ok', id: 'ticket' });
  assert.equal(await api.sendExpoPush(token, 'Mining', 'Ready', { type: 'mining_complete' }), true);
  assert.equal(api.sends[0][1].channelId, 'default');
  assert.equal(api.sends[0][1].sound, 'default');
  for (const ticket of [undefined, {}, { status: 'ok' }, { status: 'error', details: { error: 'InvalidCredentials' } }]) {
    assert.equal(await backend(ticket).sendExpoPush(token, 't', 'b'), false);
  }
  assert.equal(await backend(null, true).sendExpoPush(token, 't', 'b'), false);
});
test('DeviceNotRegistered removes only the rejected token', async () => {
  const api = backend({ status: 'error', details: { error: 'DeviceNotRegistered' } });
  assert.equal(await api.sendExpoPush(token, 't', 'b'), false);
  assert.match(api.queries[0][0], /WHERE expo_push_token = \$1/);
  assert.equal(api.queries[0][1][0], token);
});
test('mining cron respects reminder preferences, Redis cooldown and records only accepted sends', async () => {
  let run;
  const queries = [], sends = [];
  const rows = [1, 2, 3].map(id => ({ id, username: 'Miner', expo_push_token: token }));
  const task = load('../../Backend/src/tasks/notificationTask.ts', {
    'node-cron': { schedule: (schedule, fn) => { assert.equal(schedule, '0 * * * *'); run = fn; } },
    '../db/postgres': { query: async (...args) => { queries.push(args); return { rows: args[0].includes('SELECT') ? rows : [] }; } },
    '../models/settings': { SettingsModel: { get: async () => '24' } },
    '../db/redis': { ttl: async key => key.endsWith(':1') ? 10 : -2 },
    '../services/expoPush': { sendExpoPush: async (...args) => { sends.push(args); return sends.length === 1; } },
  }, { console: { log() {}, error() {} } });
  task.initNotificationTask();
  await run();
  assert.match(queries[0][0], /u\.mining_reminders_enabled = TRUE/);
  assert.equal(sends.length, 2);
  assert.equal(sends[0][3].type, 'mining_complete');
  assert.equal(queries.length, 2);
  assert.equal(queries[1][1][0], 2);
});

function native({ platform = 'android', go = false, signedIn = true, cold = null, permission = 'undetermined' } = {}) {
  const h = hooks();
  const events = {}, calls = { channels: [], tokens: [], requests: 0, routes: [], refreshes: 0, errors: [] };
  let handler;
  const notifications = {
    DEFAULT_ACTION_IDENTIFIER: 'default', AndroidImportance: { HIGH: 4 },
    setNotificationHandler(value) { handler = value; },
    setNotificationChannelAsync: async (...args) => { calls.channels.push(args); },
    getPermissionsAsync: async () => ({ status: permission, canAskAgain: permission === 'undetermined' }),
    requestPermissionsAsync: async () => { calls.requests++; return { status: 'granted' }; },
    getExpoPushTokenAsync: async () => ({ data: token }),
    addNotificationReceivedListener(fn) { events.received = fn; return { remove() {} }; },
    addNotificationResponseReceivedListener(fn) { events.open = fn; return { remove() {} }; },
    getLastNotificationResponseAsync: async () => cold,
    clearLastNotificationResponseAsync: async () => {},
  };
  const { usePushRegistration } = load('../hooks/usePushRegistration.ts', {
    react: h.react,
    'react-native': { Platform: { OS: platform }, AppState: { addEventListener(_, fn) { events.active = fn; return { remove() {} }; } } },
    'expo-notifications': notifications,
    'expo-constants': { executionEnvironment: go ? 'storeClient' : 'standalone', expoConfig: { extra: { eas: { projectId: 'project' } } } },
    'expo-router': { router: { push: route => calls.routes.push(route) } },
    '@/services/api': { userApi: { registerPushToken: async value => calls.tokens.push(value) } },
    '@/services/refresh': { refreshBackendData: () => calls.refreshes++ },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast: value => calls.errors.push(value) }) },
  });
  h.render(() => usePushRegistration(signedIn));
  return { h, calls, events, handler };
}
const settle = () => new Promise(resolve => setImmediate(resolve));
const response = (data, id = 'one') => ({ actionIdentifier: 'default', notification: { request: { identifier: id, content: { data } } } });

test('Android creates matching channel, requests permission and registers once per token', async () => {
  const app = native();
  await settle();
  assert.equal(app.calls.channels[0][0], 'default');
  assert.equal(app.calls.requests, 1);
  assert.deepEqual(app.calls.tokens, [token]);
  app.events.active('active');
  app.events.active('active');
  await settle();
  assert.equal(app.calls.requests, 1);
  assert.equal(app.calls.tokens.length, 1);
  const handler = await app.handler.handleNotification();
  assert.equal(handler.shouldShowBanner, true);
  assert.equal(handler.shouldPlaySound, true);
});
test('web, logged-out and Expo Go do not register remote push; denied permission is not reprompted', async () => {
  for (const options of [{ platform: 'web' }, { signedIn: false }, { go: true }, { permission: 'denied' }]) {
    const app = native(options);
    await settle();
    assert.equal(app.calls.tokens.length, 0);
    assert.equal(app.calls.requests, 0);
  }
});
test('taps open only known routes, cold-start opens ticket and duplicate responses are ignored', async () => {
  const app = native({ cold: response({ type: 'support_reply', ticketId: 42 }) });
  await settle();
  assert.equal(app.calls.routes[0].pathname, '/ticket/[id]');
  assert.equal(app.calls.routes[0].params.id, '42');
  app.events.open(response({ type: 'support_reply', ticketId: 42 }));
  assert.equal(app.calls.routes.length, 1);
  app.events.open(response({ type: 'mining_complete', screen: 'https://malicious.example' }, 'two'));
  assert.equal(app.calls.routes[1], '/(tabs)/search');
  app.events.open(response({ ticketId: '../evil', screen: 'https://malicious.example' }, 'three'));
  assert.equal(app.calls.routes[2], '/notifications');
  app.h.unmount();
  app.events.open(response({ type: 'mining_complete' }, 'four'));
  assert.equal(app.calls.routes.length, 3);
});
