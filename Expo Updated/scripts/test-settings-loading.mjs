import test from 'node:test';
import assert from 'node:assert/strict';
import { load, hooks, byId } from './auth-test-utils.mjs';

function screen(kind) {
  const h = hooks();
  let retried = 0;
  const state = { data: null, loading: true, error: null, sessions: [], notifications: [],
    unreadCount: 0, reload: async () => { retried++; } };
  const dependencies = {
    react: h.react, 'react-native': h.native, '@expo/vector-icons': { Feather: 'Feather' },
    'expo-router': { router: { canGoBack: () => false, replace() {} }, useFocusEffect() {} },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/hooks/useColors': { useColors: () => ({}) },
    '@/components/toast/ToastProvider': { useToast: () => ({ showToast() {} }) },
    '@/components/BackendScreenState': { BackendScreenState: 'BackendScreenState' },
    '@/components/kyc/parts': { Heading: 'Heading', PrimaryButton: 'PrimaryButton', Progress: 'Progress', s: {} },
    '@/components/wallet/Sheet': { Sheet: 'Sheet' },
  };
  let Component;
  if (kind === 'twofa') {
    Component = load('../components/twofa/TwoFaScreen.tsx', {
      ...dependencies, '@/services/api': { userApi: { me() {} } },
      '@/hooks/useBackendResource': { useBackendResource: () => state },
      '@/services/refresh': { refreshBackendData() {} },
      '@/components/wallet/NumericKeypad': { NumericKeypad: 'NumericKeypad' },
      '@/components/wallet/format': { BACKSPACE: 'del' },
      './CodeCircles': { CodeCircles: 'CodeCircles' }, './Steps': { OverviewStep: 'OverviewStep', SetupStep: 'SetupStep' },
      './demo': { CODE_LENGTH: 6 },
    }).TwoFaScreen;
  } else if (kind === 'sessions') {
    Component = load('../components/sessions/SessionsScreen.tsx', {
      ...dependencies, './store': { useSessions: () => state },
    }).SessionsScreen;
  } else {
    Component = load('../components/notifications/NotificationsScreen.tsx', {
      ...dependencies, './store': { useNotifications: () => state },
    }).NotificationsScreen;
  }
  return { state, render: () => h.render(Component), get retried() { return retried; } };
}
for (const kind of ['twofa', 'sessions', 'notifications']) {
  test(`${kind} initially shows loading instead of an empty or unconfigured account`, () => {
    const app = screen(kind), tree = app.render();
    assert.ok(byId(tree, `${kind}-loading`));
    assert.equal(byId(tree, `${kind}-empty`), undefined);
    assert.equal(byId(tree, 'twofa-enable'), undefined);
  });
  test(`${kind} fetch failure allows retry without pretending data is empty`, () => {
    const app = screen(kind);
    app.state.loading = false; app.state.error = 'Server unavailable';
    const tree = app.render(), loader = byId(tree, `${kind}-loading`);
    assert.equal(loader.props.error, 'Server unavailable');
    loader.props.onRetry();
    assert.equal(app.retried, 1);
    assert.equal(byId(tree, `${kind}-empty`), undefined);
  });
}
test('2FA uses the fetched enabled state immediately, with no not-setup flash', () => {
  const app = screen('twofa');
  app.render();
  app.state.data = { twofa_enabled: true }; app.state.loading = false;
  let tree = app.render();
  assert.ok(byId(tree, 'twofa-disable'));
  assert.equal(byId(tree, 'twofa-enable'), undefined);
  app.state.data = { twofa_enabled: false };
  tree = app.render();
  assert.ok(byId(tree, 'twofa-enable'));
});
for (const kind of ['sessions', 'notifications']) {
  test(`${kind} displays a genuine empty state only after a successful response`, () => {
    const app = screen(kind);
    app.render();
    app.state.loading = false;
    assert.ok(byId(app.render(), `${kind}-empty`));
  });
}
