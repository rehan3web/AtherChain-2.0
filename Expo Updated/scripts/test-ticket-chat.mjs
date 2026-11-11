import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(screen, status = 'Open') {
  const hooks = [], refs = [], routes = [], toasts = [], sent = [];
  let cursor = 0, refCursor = 0, fail = false, pending = null;
  const state = { tickets: [{ id: 'AT-1', subject: 'Question', description: 'Original request',
    status, date: 'Today', attachments: [{ id: 'photo', name: 'image.png', kind: 'PNG', size: 50, uri: 'data:image/png;base64,eA==' }],
    messages: [{ id: 'm1', body: 'Earlier message', createdAt: '2026-11-08T08:00:00.000Z', author: 'user', attachments: [] }] }],
    loading: false, error: null };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => { const i = cursor++; if (!(i in hooks)) hooks[i] = initial;
      return [hooks[i], next => { hooks[i] = typeof next === 'function' ? next(hooks[i]) : next; }]; },
    useRef: initial => { const i = refCursor++; return refs[i] ?? (refs[i] = { current: initial }); },
    useEffect: () => {},
  };
  const send = async (...args) => { sent.push(args); if (pending) await pending; if (fail) throw Error('storage'); };
  const deps = {
    react,
    'react-native': Object.fromEntries(['Image','Modal','Pressable','ScrollView','Text','TextInput','View'].map(x => [x,x])),
    '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: { push: route => routes.push(route), canGoBack: () => false, replace: route => routes.push(route) },
      useLocalSearchParams: () => ({ id: 'AT-1' }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20 }) },
    'react-native-keyboard-controller': { KeyboardAvoidingView: 'KeyboardAvoidingView' },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/hooks/useTheme': { useTheme: () => ({ scheme: 'light' }) },
    '@/components/toast/ToastProvider': { ToastSurface: 'ToastSurface', useToast: () => ({ showToast: t => toasts.push(t) }) },
    '@/components/KeyboardAwareScrollViewCompat': { KeyboardAwareScrollViewCompat: 'ScrollView' },
    './TicketUploader': { TicketUploader: 'TicketUploader' },
    './TicketFilter': { TicketFilter: 'TicketFilter' },
    './tickets': { useTickets: () => state, canReply: s => s === 'Open', loadTickets: async () => {},
      sendTicketMessage: send, createTicket: async (...args) => { await send(...args); return { id: 'AT-2' }; } },
  };
  deps['react-native'].Platform = { OS: 'web' };
  deps['react-native'].Linking = {};
  deps['react-native'].StyleSheet = { create: x => x, hairlineWidth: 1 };
  const source = fs.readFileSync(new URL(`../components/help/${screen}.tsx`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, setTimeout, clearTimeout, require: name => {
    assert.ok(name in deps, `Unexpected dependency ${name}`); return deps[name];
  } });
  const render = () => { cursor = refCursor = 0; return exports[screen](); };
  const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...(n.props?.children ?? []).flat(Infinity).flatMap(nodes)];
  const byId = id => nodes(render()).find(n => n.props.testID === id);
  return { state, routes, sent, toasts, byId, nodes, render,
    set fail(value) { fail = value; }, set pending(value) { pending = value; },
    press: id => { const n = byId(id); assert.ok(n, id); return n.props.onPress(); },
    change: (id, value) => byId(id).props.onChangeText(value),
  };
}

test('open ticket has a status, original attachment and chat; successful send clears draft', async () => {
  const app = harness('TicketChatScreen');
  assert.ok(app.byId('ticket-chat-status'));
  assert.ok(app.byId('ticket-chat-input'));
  app.change('ticket-chat-input', 'Follow up');
  await app.press('ticket-chat-send');
  assert.equal(app.sent[0][0], 'AT-1');
  assert.equal(app.sent[0][1], 'Follow up');
  assert.equal(app.byId('ticket-chat-input').props.value, '');
});

test('read-only statuses show reason and omit composer and attachment controls', () => {
  for (const status of ['Closed', 'Resolved', 'Rejected']) {
    const app = harness('TicketChatScreen', status);
    assert.ok(app.byId('ticket-chat-readonly'));
    assert.equal(app.byId('ticket-chat-status').props.accessibilityLabel, `Status ${status}`);
    assert.equal(app.byId('ticket-chat-input'), undefined);
    assert.equal(app.byId('ticket-chat-send'), undefined);
    assert.equal(app.byId('ticket-chat-attach'), undefined);
  }
});

test('send failure keeps draft, duplicate pending sends blocked and attachments supported', async () => {
  const app = harness('TicketChatScreen');
  app.change('ticket-chat-input', 'Keep this');
  app.fail = true;
  await app.press('ticket-chat-send');
  assert.equal(app.byId('ticket-chat-input').props.value, 'Keep this');
  assert.equal(app.toasts.at(-1).kind, 'error');
  app.fail = false;
  let resolve;
  app.pending = new Promise(r => { resolve = r; });
  const first = app.press('ticket-chat-send');
  await app.press('ticket-chat-send');
  assert.equal(app.sent.length, 2);
  resolve(); await first;
  await app.press('ticket-chat-attach');
  const uploader = app.nodes(app.render()).find(n => n.type === 'TicketUploader');
  uploader.props.onChange([{ id: 'x', name: 'photo.png', uri: 'data:image/png;base64,eA==', kind: 'PNG', size: 1 }]);
  await app.press('ticket-chat-send');
  assert.equal(app.sent.at(-1)[2].length, 1);
});

test('loading, failed hydration and missing ticket never show a composer', () => {
  const app = harness('TicketChatScreen');
  app.state.loading = true;
  assert.equal(app.byId('ticket-chat-input'), undefined);
  app.state.loading = false; app.state.error = 'Could not load';
  assert.ok(app.byId('ticket-chat-retry'));
  assert.equal(app.byId('ticket-chat-input'), undefined);
  app.state.error = null; app.state.tickets = [];
  assert.equal(app.byId('ticket-chat-input'), undefined);
  app.press('ticket-chat-back');
  assert.equal(app.routes[0], '/help');
});

test('Help opens a separate ticket route; successful create navigates there and failed save preserves draft', async () => {
  const app = harness('HelpScreen');
  await app.press('help-ticket-AT-1');
  assert.equal(app.routes[0].pathname, '/ticket/[id]');
  await app.press('help-create');
  app.change('help-subject', 'New question');
  app.change('help-description', 'Please help');
  app.fail = true;
  await app.press('help-submit');
  assert.equal(app.byId('help-subject').props.value, 'New question');
  assert.ok(app.byId('help-form-error'));
  app.fail = false;
  await app.press('help-submit');
  assert.equal(app.routes.at(-1).params.id, 'AT-2');
});
