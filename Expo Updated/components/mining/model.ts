export const CYCLE_MS = 12 * 60 * 60 * 1000;
export const RATE_PER_HOUR = 0.0131;
export const MINIMUM_CLAIM = 0.01;
export const REWARD_MICROS = 157_200;
const INITIAL_MINED_MICROS = 67_989_040_000;
const MAX_CLAIMS = Math.floor((Number.MAX_SAFE_INTEGER - INITIAL_MINED_MICROS) / REWARD_MICROS);

export type MiningState = { version: 1; cycleStartedAt: number; claims: number; claimDays?: readonly string[] };
export type MiningSnapshot = {
  progress: number;
  remainingMs: number;
  canClaim: boolean;
  pendingReward: number;
  totalMined: number;
  totalBalance: number;
  claimCount: number;
  ratePerHour: number;
  cycleReward: number;
  minimumClaim: number;
};

export function initialMiningState(now: number): MiningState {
  return { version: 1, cycleStartedAt: now - CYCLE_MS, claims: 0, claimDays: [] };
}

/** Use the device-local calendar day, not a UTC date or an elapsed 24-hour bucket. */
export function claimDayKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function validClaimDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function savedClaimDays(state: MiningState): readonly string[] {
  // Legacy records contain only the latest claim timestamp. Do not invent earlier days.
  return state.claimDays ?? (state.claims > 0 ? [claimDayKey(state.cycleStartedAt)] : []);
}

export function parseMiningState(raw: string): MiningState {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error('Invalid saved demo mining data.');
  const record = value as Record<string, unknown>;
  if (
    record.version !== 1 ||
    typeof record.cycleStartedAt !== 'number' ||
    !Number.isSafeInteger(record.cycleStartedAt) ||
    record.cycleStartedAt < 0 ||
    !Number.isFinite(new Date(record.cycleStartedAt).getTime()) ||
    typeof record.claims !== 'number' ||
    !Number.isSafeInteger(record.claims) ||
    record.claims < 0 ||
    record.claims > MAX_CLAIMS
  ) throw new Error('Saved demo mining data is invalid. It has not been overwritten.');
  if (record.claimDays !== undefined && (
    !Array.isArray(record.claimDays) || record.claimDays.some(day => !validClaimDay(day)) ||
    new Set(record.claimDays).size !== record.claimDays.length || record.claimDays.length > record.claims
  )) throw new Error('Saved claim calendar is invalid. It has not been overwritten.');
  const state: MiningState = {
    version: 1, cycleStartedAt: record.cycleStartedAt, claims: record.claims,
    ...(record.claimDays !== undefined ? { claimDays: (record.claimDays as string[]).slice().sort() } : {}),
  };
  return { ...state, claimDays: savedClaimDays(state) };
}

export function miningSnapshot(state: MiningState, now: number): MiningSnapshot {
  const elapsed = Math.min(CYCLE_MS, Math.max(0, now - state.cycleStartedAt));
  const progress = elapsed / CYCLE_MS;
  const total = (INITIAL_MINED_MICROS + state.claims * REWARD_MICROS) / 1_000_000;
  return {
    progress,
    remainingMs: CYCLE_MS - elapsed,
    canClaim: elapsed === CYCLE_MS,
    pendingReward: Math.floor(REWARD_MICROS * progress) / 1_000_000,
    totalMined: total,
    totalBalance: total,
    claimCount: state.claims,
    ratePerHour: RATE_PER_HOUR,
    cycleReward: REWARD_MICROS / 1_000_000,
    minimumClaim: MINIMUM_CLAIM,
  };
}

export function claimMining(state: MiningState, now: number): MiningState {
  if (!miningSnapshot(state, now).canClaim) throw new Error('Your next demo claim is ready after 12 hours.');
  if (state.claims >= MAX_CLAIMS) throw new Error('Demo balance limit reached.');
  return {
    version: 1, cycleStartedAt: now, claims: state.claims + 1,
    claimDays: [...new Set([...savedClaimDays(state), claimDayKey(now)])].sort(),
  };
}
