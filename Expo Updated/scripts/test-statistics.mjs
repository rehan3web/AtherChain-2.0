import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as mining from '../components/mining/model.ts';

const code = ts.transpileModule(fs.readFileSync(new URL('../components/statistics/model.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const stats = {};
vm.runInNewContext(code, { exports: stats, Date, require(name) {
  assert.equal(name, '../mining/model');
  return mining;
} });
const NOW = new Date(2026, 10, 11, 12, 30).getTime();
const TODAY = '2026-11-11';

test('successful claims preserve calendar days atomically with the mining state', () => {
  const before = mining.initialMiningState(NOW);
  const claimed = mining.claimMining(before, NOW);
  assert.deepEqual(before.claimDays, []);
  assert.deepEqual(claimed.claimDays, [TODAY]);
  const restored = mining.parseMiningState(JSON.stringify(claimed));
  assert.deepEqual(restored, claimed);
  assert.equal(mining.miningSnapshot(restored, NOW).claimCount, 1);
});

test('two claims on the same local day produce only one verified calendar day', () => {
  const midnight = new Date(2026, 10, 11, 0, 1).getTime();
  const first = mining.claimMining(mining.initialMiningState(midnight), midnight);
  const second = mining.claimMining(first, midnight + mining.CYCLE_MS);
  assert.equal(second.claims, 2);
  assert.deepEqual(second.claimDays, [TODAY]);
  assert.equal(stats.miningStreak(second.claimDays, NOW), 1);
});

test('legacy mining data preserves only the last provable day instead of fabricating a streak', () => {
  const state = mining.parseMiningState(JSON.stringify({
    version: 1, cycleStartedAt: new Date(2026, 10, 10, 12).getTime(), claims: 50,
  }));
  assert.deepEqual(state.claimDays, ['2026-11-10']);
  assert.equal(stats.miningStreak(state.claimDays, NOW), 1);
  assert.equal(state.claims, 50);
});

test('invalid calendar data is rejected rather than reset or shown as verified', () => {
  for (const claimDays of [null, ['2026-02-30'], ['2026-13-01'], [123], [TODAY, TODAY], ['2026-11-10', TODAY]]) {
    assert.throws(() => mining.parseMiningState(JSON.stringify({ version: 1, cycleStartedAt: NOW, claims: 1, claimDays })));
  }
  assert.throws(() => mining.parseMiningState(JSON.stringify({ version: 1, cycleStartedAt: Number.MAX_SAFE_INTEGER, claims: 1 })));
});

test('local calendar dates do not shift at midnight or use UTC-day assumptions', () => {
  assert.equal(mining.claimDayKey(new Date(2026, 10, 11, 0, 1).getTime()), TODAY);
  assert.equal(mining.claimDayKey(new Date(2026, 10, 11, 23, 59).getTime()), TODAY);
  assert.equal(stats.shiftDay('2026-01-01', -1), '2025-12-31');
  assert.equal(stats.shiftDay('2024-03-01', -1), '2024-02-29');
  assert.equal(stats.shiftDay('2026-03-09', -1), '2026-03-08');
});

test('streaks count consecutive days, keep yesterday active and reset after a missed day', () => {
  const tenDays = Array.from({ length: 10 }, (_, index) => stats.shiftDay(TODAY, -index));
  assert.equal(stats.miningStreak(tenDays, NOW), 10);
  assert.equal(stats.miningStreak(tenDays.slice(1), NOW), 9);
  assert.equal(stats.miningStreak(tenDays.slice(2), NOW), 0);
  assert.equal(stats.miningStreak([TODAY, '2026-11-10', '2026-11-08'], NOW), 2);
  assert.equal(stats.miningStreak([], NOW), 0);
});

test('calendar uses Monday-first whole weeks and supports leap years and month boundaries', () => {
  const february = stats.monthDays(2024, 1, ['2024-02-29'], NOW);
  assert.equal(february.length % 7, 0);
  assert.equal(february.slice(0, 3).every(day => day === null), true);
  assert.equal(february.filter(Boolean).length, 29);
  assert.equal(february.find(day => day?.day === 29).claimed, true);
  const month = stats.monthDays(2026, 10, [TODAY, '2026-10-31'], NOW);
  assert.equal(month.filter(day => day?.claimed).length, 1);
  assert.equal(month.find(day => day?.today).key, TODAY);
  assert.equal(stats.monthDays(2026, 5, [], NOW)[0].day, 1);
});

test('totals count completed swaps and transfers, excluding sample payments, mining and boosts', () => {
  const transfer = { id: 'transfer-1', receipt: { type: 'send', currency: 'ATH', data: {} } };
  const swap = { id: 'swap-1', preview: true, receipt: { type: 'swap', data: {} } };
  const sample = { ...transfer, id: 'sample', isSample: true };
  const claim = { id: 'claim-1', receipt: { type: 'send', currency: 'AT', data: {} } };
  const totals = stats.activityTotals([transfer, swap, sample, claim, { id: 'boost-1' }, transfer, swap]);
  assert.equal(totals.swaps, 1);
  assert.equal(totals.transfers, 1);
  assert.equal(stats.activityTotals([]).swaps, 0);
  assert.equal(stats.activityTotals([sample, claim]).transfers, 0);
});

test('calendar has explicit seven-cell rows, including empty dates, for every month shape', () => {
  for (let year = 2024; year <= 2028; year++) {
    for (let month = 0; month < 12; month++) {
      const weeks = stats.monthWeeks(year, month, [TODAY], NOW);
      assert.ok(weeks.length >= 4 && weeks.length <= 6);
      for (const week of weeks) assert.equal(week.length, 7);
      const actual = weeks.flat().filter(Boolean);
      assert.equal(actual.length, new Date(year, month + 1, 0).getDate());
      actual.forEach((day, index) => assert.equal(day.day, index + 1));
      const first = weeks[0].findIndex(Boolean);
      assert.equal(first, (new Date(year, month, 1).getDay() + 6) % 7);
    }
  }
});

test('native calendar uses equal flexible cells rather than rounded window-width wrapping', () => {
  const calendar = fs.readFileSync(new URL('../components/statistics/ClaimCalendar.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(calendar, /useWindowDimensions|cellWidth|flexWrap/);
  assert.match(calendar, /cell: \{ flex: 1, minWidth: 0 \}/);
  assert.match(calendar, /statistics-weekdays/);
  assert.match(calendar, /statistics-week-\$\{index\}/);
});

test('dashboard Statistics shortcut opens the protected standalone page, not the old sheet', () => {
  const dashboard = fs.readFileSync(new URL('../components/dashboard/DashboardScreen.tsx', import.meta.url), 'utf8');
  const layout = fs.readFileSync(new URL('../app/_layout.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /next === 'statistics'.*router\.push\('\/statistics'\)/);
  assert.doesNotMatch(dashboard, /dashboard-statistics-panel/);
  assert.match(layout, /Stack\.Screen name="statistics"/);
});
