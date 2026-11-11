import { claimDayKey } from '../mining/model';
import type { Activity } from '../activity/store';

/** Date keys are calendar dates; UTC arithmetic here avoids local DST hour changes. */
export function shiftDay(key: string, offset: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function miningStreak(claimDays: readonly string[], now: number): number {
  const days = new Set(claimDays);
  const today = claimDayKey(now);
  let cursor = days.has(today) ? today : shiftDay(today, -1);
  let count = 0;
  while (days.has(cursor)) {
    count++;
    cursor = shiftDay(cursor, -1);
  }
  return count;
}

export type CalendarDay = { key: string; day: number; claimed: boolean; today: boolean };
export function monthDays(year: number, month: number, claimDays: readonly string[], now: number): (CalendarDay | null)[] {
  const first = new Date(year, month, 1, 12);
  const leading = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0, 12).getDate();
  const claimed = new Set(claimDays);
  const today = claimDayKey(now);
  const cells: (CalendarDay | null)[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= count; day++) {
    const key = claimDayKey(new Date(year, month, day, 12).getTime());
    cells.push({ key, day, claimed: claimed.has(key), today: key === today });
  }
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function monthWeeks(year: number, month: number, claimDays: readonly string[], now: number) {
  const days = monthDays(year, month, claimDays, now);
  return Array.from({ length: days.length / 7 }, (_, week) => days.slice(week * 7, week * 7 + 7));
}

export function activityTotals(activities: readonly Activity[]) {
  const seen = new Set<string>();
  let swaps = 0, transfers = 0;
  for (const item of activities) {
    if (seen.has(item.id) || item.isSample || !item.receipt) continue;
    seen.add(item.id);
    if (item.receipt.type === 'swap') swaps++;
    else if (item.receipt.currency === 'ATH') transfers++;
  }
  return { swaps, transfers };
}
