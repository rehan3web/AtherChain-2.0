export type MiningSnapshot = {
  progress: number; remainingMs: number; canClaim: boolean; pendingReward: number;
  totalMined: number; totalBalance: number; claimCount: number; ratePerHour: number;
  cycleReward: number; minimumClaim: number;
};
export type BackendMiningData = {
  status: { canMine: boolean; timeLeft: number; currentYield: number; dailyReward: number };
  profile: { at_balance: string; mining_sessions_count?: number; last_mined_at?: string };
  receivedAt: number; totalMined: number;
};

/** The backend mining calendar uses UTC dates. */
export function claimDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}
export function validClaimDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function miningSnapshot(data: BackendMiningData, now: number): MiningSnapshot {
  const balance = Number(data.profile.at_balance);
  const yieldAmount = Number(data.status.currentYield);
  if (![balance, yieldAmount, Number(data.status.timeLeft), Number(data.status.dailyReward), data.totalMined].every(Number.isFinite))
    throw new Error('The backend returned invalid mining balances or rewards.');
  const elapsed = Math.max(0, now - data.receivedAt);
  const remainingMs = Math.max(0, Number(data.status.timeLeft) * 1000 - elapsed);
  const lastMined = data.profile.last_mined_at ? new Date(data.profile.last_mined_at).getTime() : null;
  const duration = lastMined ? data.receivedAt + Number(data.status.timeLeft) * 1000 - lastMined : null;
  return {
    progress: data.status.canMine ? 1 : duration && duration > 0 ? Math.max(0, Math.min(1, 1 - remainingMs / duration)) : 0,
    remainingMs, canClaim: data.status.canMine === true,
    pendingReward: yieldAmount, totalMined: data.totalMined, totalBalance: balance,
    claimCount: Number(data.profile.mining_sessions_count ?? 0),
    ratePerHour: Number(data.status.dailyReward) / 24,
    cycleReward: yieldAmount, minimumClaim: 0,
  };
}
