import assert from 'node:assert/strict';
import test from 'node:test';
import { load, hooks, byId, nodes } from './auth-test-utils.mjs';

function sessions() {
  let loader, cleared = 0, reloads = 0;
  let rows = [{ id: 'current', device: 'Android', loginTime: '2026-11-12T08:00:00Z', isCurrent: true },
    { id: 'other', device: 'Web Chrome', loginTime: '2026-11-12T07:00:00Z', isCurrent: false }];
  const deleted = [];
  const resource = { data: rows.map(row => ({ id: row.id, device: row.device, current: row.isCurrent })), error: null,
    async reload() { reloads++; resource.data = await loader(); } };
  const model = load('../components/sessions/store.ts', {
    '@/services/api': {
      authApi: { getSessions: async () => ({ sessions: rows }),
        removeSession: async id => { deleted.push(id); rows = rows.filter(row => row.id !== id); },
        removeAllSessions: async () => { rows = []; } },
      clearToken: async () => { cleared++; },
    },
    '@/hooks/useBackendResource': { useBackendResource: fn => { loader = fn; return resource; } },
  });
  return { get: model.useSessions, deleted, resource, counts: () => ({ cleared, reloads }), load: () => loader() };
}
test('removing another session calls the real API contract and refreshes without signing out this device', async () => {
  const h = sessions(); await h.get().signOutSession('other');
  assert.deepEqual(h.deleted, ['other']); assert.deepEqual(h.counts(), { cleared: 0, reloads: 1 });
  assert.equal(h.get().sessions.length, 1);
});
test('removing the current session clears its authentication token', async () => {
  const h = sessions(); await h.get().signOutSession('current');
  assert.equal(h.counts().cleared, 1); assert.equal(h.counts().reloads, 0);
});
test('signing out all sessions clears the local token only after the backend succeeds', async () => {
  const h = sessions(); assert.equal(await h.get().signOutAll(), 2); assert.equal(h.counts().cleared, 1);
});
test('real session data maps current state and device platform', async () => {
  const h = sessions(); h.get(); const rows = await h.load();
  assert.equal(rows[0].platform, 'android'); assert.equal(rows[1].platform, 'web');
  assert.equal(rows[0].startedAt, '2026-11-12T08:00:00Z');
});
test('login recovery parsing drops stored full-session tokens and rejects unusable responses', () => {
  const { readSessionLimit } = load('../components/onboarding/sessionLimit.ts');
  const limit = readSessionLimit({ data: { code: 'SESSION_LIMIT_EXCEEDED', sessionManagementToken: 'limited',
    sessions: [{ id: 'one', device: 'Phone', token: 'private-full-token' }] } });
  assert.equal(limit.sessions[0].token, undefined);
  assert.throws(() => readSessionLimit({ data: { code: 'SESSION_LIMIT_EXCEEDED', sessions: [] } }), /session recovery/);
  assert.equal(readSessionLimit({ data: { code: 'OTHER_ERROR' } }), null);
});
test('the bottom sheet presents selected-session actions with per-row pending state', () => {
  const h = hooks(), removed = [];
  const { SessionLimitSheet } = load('../components/onboarding/SessionLimitSheet.tsx', {
    react: h.react, 'react-native': h.native, '@/components/wallet/Sheet': { Sheet: 'Sheet' },
    '@/hooks/useColors': { useColors: () => ({}) }, '@/components/kyc/parts': { PrimaryButton: 'Button' },
  });
  const tree = h.render(() => SessionLimitSheet({ limit: { token: 'must-not-render', sessions: [
    { id: 'one', device: 'Phone' }, { id: 'two', device: 'Browser' }] }, removing: 'one',
    onRemove: id => removed.push(id), onClose() {} }));
  assert.equal(tree.props.open, true);
  assert.equal(byId(tree, 'login-remove-session-one').props.loading, true);
  assert.equal(byId(tree, 'login-remove-session-two').props.disabled, true);
  assert.equal(byId(tree, 'login-session-cancel').props.disabled, true);
  byId(tree, 'login-remove-session-two').props.onPress(); assert.deepEqual(removed, ['two']);
  assert.ok(!JSON.stringify(nodes(tree)).includes('must-not-render'));
});
