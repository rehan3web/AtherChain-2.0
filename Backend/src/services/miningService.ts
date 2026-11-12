import { Types } from 'mongoose';
import { LedgerError, runOperation } from './ledgerOperations';
import { decimal, money } from './ledgerMoney';

export class MiningService {
    static async execute(userId: string, key: string, boost = false) {
        return runOperation<{
            message: string; referral: string | null;
            boostReward?: number; currentCycleBoosts?: number; reward?: number; newBalance?: number;
        }>(userId, boost ? 'boost' : 'mining', key, {}, async (client, id) => {
            const settingsRows = await client.query(
                `SELECT key,value FROM system_settings WHERE key=ANY($1::text[])`,
                [['mining', 'boost_reward_amount', 'boost_enabled', 'daily_boost_max', 'mining_cycle_hours']]
            );
            const settings: Record<string, any> = Object.fromEntries(settingsRows.rows.map(row => [row.key, row.value]));
            const userResult = await client.query(
                `SELECT at_balance,is_blocked,is_mining_enabled,mining_paused,current_cycle_boosts,
                        last_mined_at,referred_by FROM users WHERE id=$1`, [userId]
            );
            const user = userResult.rows[0];
            if (!settings.mining?.active || user.is_blocked || user.is_mining_enabled === false || user.mining_paused)
                throw new LedgerError(403, 'Mining is disabled for this account');
            const usedBoosts = Number(user.current_cycle_boosts ?? 0);
            if (!Number.isInteger(usedBoosts) || usedBoosts < 0 || usedBoosts > 1000)
                throw new LedgerError(503, 'Invalid stored boost count');
            const cycle = Number(settings.mining_cycle_hours ?? 24);
            if (!Number.isInteger(cycle) || cycle < 1 || cycle > 8760) throw new LedgerError(503, 'Invalid mining cycle configuration');
            const boostReward = money(settings.boost_reward_amount ?? '0.1', true);
            if (boost) {
                if (settings.boost_enabled !== true && settings.boost_enabled !== 'true')
                    throw new LedgerError(403, 'Boost feature is currently disabled');
                const max = Number(settings.daily_boost_max ?? 3);
                if (!Number.isInteger(max) || max < 0 || max > 1000) throw new LedgerError(503, 'Invalid boost configuration');
                const updated = await client.query(
                    `UPDATE users SET current_cycle_boosts=COALESCE(current_cycle_boosts,0)+1
                     WHERE id=$1 AND COALESCE(current_cycle_boosts,0) < $2 RETURNING current_cycle_boosts`, [userId, max]
                );
                if (updated.rowCount !== 1) throw new LedgerError(400, 'Maximum boosts for this cycle already used');
                return { value: {
                    message: 'Boost applied successfully!', boostReward: Number(decimal(boostReward)),
                    currentCycleBoosts: updated.rows[0].current_cycle_boosts, referral: null as string | null
                }, events: [] };
            }
            const reward = money(settings.mining.daily_reward ?? '1', true) + BigInt(usedBoosts) * boostReward;
            const updated = await client.query(
                `UPDATE users SET at_balance=at_balance+$1,
                 mining_days_count=mining_days_count+CASE WHEN DATE(last_mined_at AT TIME ZONE 'UTC') < CURRENT_DATE OR last_mined_at IS NULL THEN 1 ELSE 0 END,
                 mining_sessions_count=mining_sessions_count+1,last_mined_at=NOW(),current_cycle_boosts=0
                 WHERE id=$2 AND (last_mined_at IS NULL OR last_mined_at <= NOW()-($3 * INTERVAL '1 hour'))
                 RETURNING at_balance`, [decimal(reward), userId, cycle]
            );
            if (updated.rowCount !== 1) throw new LedgerError(429, 'Mining session is in cooldown');
            const now = new Date();
            const txHash = `mine_${id}`;
            return {
                value: {
                    message: 'Claim successful', reward: Number(decimal(reward)), newBalance: Number(updated.rows[0].at_balance),
                    referral: user.last_mined_at === null ? user.referred_by as string | null : null
                },
                events: [
                    { collection: 'mining', document: { _id: new Types.ObjectId().toHexString(), userId, date: now.toISOString().slice(0, 10), reward: decimal(reward), timestamp: now.toISOString() } },
                    { collection: 'transactions', document: { _id: new Types.ObjectId().toHexString(), userId, txHash, type: 'mining', amount: decimal(reward), status: 'completed', createdAt: now.toISOString() } }
                ]
            };
        });
    }
}
