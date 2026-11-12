import test from 'node:test';
import assert from 'node:assert/strict';
import { miningSnapshot, claimDayKey, validClaimDay } from '../components/mining/model.ts';

const NOW = Date.parse('2026-11-11T12:00:00Z');
function fixture(overrides = {}) {
  return {
    status: { canMine: false, timeLeft: 3600, currentYield: 2.75, dailyReward: 2.5 },
    profile: { at_balance: '8.25', mining_sessions_count: 4, last_mined_at: '2026-11-11T01:00:00Z' },
    receivedAt: NOW, totalMined: 12.5, ...overrides,
  };
}
test('mining amounts and history totals come entirely from the server', () => {
  const view = miningSnapshot(fixture(), NOW);
  assert.equal(view.totalBalance, 8.25); assert.equal(view.totalMined, 12.5);
  assert.equal(view.cycleReward, 2.75); assert.equal(view.claimCount, 4);
});
test('the server cooldown is displayed without granting local eligibility', () => {
  const view = miningSnapshot(fixture(), NOW + 3600_000);
  assert.equal(view.remainingMs, 0); assert.equal(view.canClaim, false);
});
test('progress follows the actual cycle rather than a hardcoded twelve-hour simulation', () => {
  const view = miningSnapshot(fixture(), NOW);
  assert.equal(view.progress, 11 / 12);
  assert.equal(view.remainingMs, 3600_000);
});
test('eligibility is granted only by a fresh canMine response', () => {
  const data = fixture();
  data.status = { ...data.status, canMine: true, timeLeft: 0 };
  const view = miningSnapshot(data, NOW);
  assert.equal(view.canClaim, true); assert.equal(view.progress, 1);
});
test('clock changes cannot lengthen the server countdown', () => {
  assert.equal(miningSnapshot(fixture(), NOW - 5000).remainingMs, 3600_000);
});
test('invalid server balances fail instead of falling back to a fake initial balance', () => {
  const data = fixture(); data.profile.at_balance = 'not-a-balance';
  assert.throws(() => miningSnapshot(data, NOW), /invalid mining balances/);
});
test('claim days use backend UTC dates and reject impossible calendar dates', () => {
  assert.equal(claimDayKey(Date.parse('2026-11-11T23:30:00-08:00')), '2026-11-12');
  assert.equal(validClaimDay('2026-02-30'), false);
  assert.equal(validClaimDay('2026-11-11'), true);
});
