import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CYCLE_MS, claimMining, initialMiningState, miningSnapshot, parseMiningState,
} from '../components/mining/model.ts';

const NOW = 1_800_000_000_000;

test('a new demo has a full, claimable cycle', () => {
  const view = miningSnapshot(initialMiningState(NOW), NOW);
  assert.equal(view.progress, 1);
  assert.equal(view.canClaim, true);
  assert.equal(view.remainingMs, 0);
  assert.equal(view.pendingReward, 0.1572);
  assert.equal(view.totalMined, 67_989.04);
});

test('claim resets the grid and credits exactly one demo reward', () => {
  const claimed = claimMining(initialMiningState(NOW), NOW);
  const view = miningSnapshot(claimed, NOW);
  assert.equal(view.progress, 0);
  assert.equal(view.pendingReward, 0);
  assert.equal(view.remainingMs, CYCLE_MS);
  assert.equal(view.canClaim, false);
  assert.equal(view.claimCount, 1);
  assert.equal(view.totalBalance, 67_989.1972);
  assert.throws(() => claimMining(claimed, NOW), /12 hours/);
});

test('a half-filled cycle is not claimable even above the minimum reward', () => {
  const state = claimMining(initialMiningState(NOW), NOW);
  const view = miningSnapshot(state, NOW + CYCLE_MS / 2);
  assert.equal(view.progress, 0.5);
  assert.equal(view.remainingMs, CYCLE_MS / 2);
  assert.equal(view.pendingReward, 0.0786);
  assert.ok(view.pendingReward > view.minimumClaim);
  assert.equal(view.canClaim, false);
});

test('claim stays blocked until the exact twelve-hour boundary', () => {
  const state = claimMining(initialMiningState(NOW), NOW);
  assert.equal(miningSnapshot(state, NOW + CYCLE_MS - 1).canClaim, false);
  assert.throws(() => claimMining(state, NOW + CYCLE_MS - 1), /12 hours/);
  assert.equal(miningSnapshot(state, NOW + CYCLE_MS).canClaim, true);
  const next = claimMining(state, NOW + CYCLE_MS);
  assert.equal(next.claims, 2);
  assert.equal(miningSnapshot(next, NOW + CYCLE_MS).progress, 0);
});

test('remaining offline beyond twelve hours caps progress to one full cycle', () => {
  const state = claimMining(initialMiningState(NOW), NOW);
  const view = miningSnapshot(state, NOW + 7 * CYCLE_MS);
  assert.equal(view.progress, 1);
  assert.equal(view.pendingReward, 0.1572);
  assert.equal(view.remainingMs, 0);
});

test('saved timestamps restore elapsed progress rather than starting a new timer', () => {
  const state = claimMining(initialMiningState(NOW), NOW);
  const saved = parseMiningState(JSON.stringify(state));
  assert.deepEqual(saved, state);
  assert.equal(miningSnapshot(saved, NOW + CYCLE_MS / 4).progress, 0.25);
  assert.equal(miningSnapshot(saved, NOW + CYCLE_MS).canClaim, true);
});

test('moving the device clock backwards never creates negative progress', () => {
  const state = claimMining(initialMiningState(NOW), NOW);
  const view = miningSnapshot(state, NOW - 60_000);
  assert.equal(view.progress, 0);
  assert.equal(view.remainingMs, CYCLE_MS);
  assert.equal(view.canClaim, false);
});

test('malformed or incompatible saved data is rejected without silent resets', () => {
  for (const raw of [
    'broken', 'null', '[]', '{}',
    '{"version":2,"cycleStartedAt":1800000000000,"claims":0}',
    '{"version":1,"cycleStartedAt":-1,"claims":0}',
    '{"version":1,"cycleStartedAt":1800000000000,"claims":-1}',
    '{"version":1,"cycleStartedAt":1800000000000,"claims":0.5}',
    '{"version":1,"cycleStartedAt":1800000000000,"claims":9007199254740991}',
  ]) assert.throws(() => parseMiningState(raw));
});
