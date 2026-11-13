import test from 'node:test';
import assert from 'node:assert/strict';
import { load, hooks, byId, byType } from './auth-test-utils.mjs';

for (const status of ['approved', 'pending', 'unverified', 'rejected']) {
  test(`Settings badge displays ${status} without a tick`, () => {
    const h = hooks();
    const { KycBadge } = load('../components/settings/KycBadge.tsx', {
      react: h.react, 'react-native': h.native,
    });
    const tree = h.render(() => KycBadge({ status }));
    const badge = byId(tree, 'settings-kyc-badge');
    const text = byType(tree, 'Text');
    assert.equal(text.props.children.join(''), status === 'approved' ? 'Verified' : 'Unverified');
    assert.equal(badge.props.style.borderRadius, 999);
    assert.equal(badge.props.style.backgroundColor, status === 'approved' ? '#DCFCE7' : '#E5E7EB');
    assert.equal(byType(tree, 'Feather'), undefined);
    assert.equal(byType(tree, 'ConfirmedIcon'), undefined);
  });
}

test('profile reuses the existing profile response for KYC status', async () => {
  const h = hooks();
  let loader;
  const resource = { data: null, loading: true, error: null };
  let calls = 0;
  const { useProfile } = load('../components/settings/profile.ts', {
    '@/services/api': { userApi: { me: async () => {
      calls++;
      return { id: 'fixture', first_name: 'Test', username: 'fixture', kyc_status: 'approved' };
    } } },
    '@/hooks/useBackendResource': { useBackendResource: fn => { loader = fn; return resource; } },
  });
  assert.equal(useProfile().kycStatus, null);
  resource.data = await loader();
  resource.loading = false;
  assert.equal(useProfile().kycStatus, 'approved');
  assert.equal(calls, 1);
});
