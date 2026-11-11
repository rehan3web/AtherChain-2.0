import { Request, Response } from 'express';
import { query } from '../db/postgres';
import MiningLog from '../models/MiningLog';
import Transaction from '../models/Transaction';
import redis from '../db/redis';
import { SettingsModel } from '../models/settings';
import { UserModel } from '../models/user';
import { ReferralController } from './referral';

export const startMining = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        const lockKey = `mining_lock:${userId}`;

        // 0. Acquire a short-lived lock to prevent concurrent requests
        const lockAcquired = await redis.set(lockKey, 'locked', 'EX', 10, 'NX');
        if (!lockAcquired) {
            return res.status(429).json({ message: 'Request already in progress' });
        }

        try {

            // 1. Fetch Global Settings
            const settings = await SettingsModel.get('mining');
            if (!settings || !settings.active) {
                return res.status(403).json({ message: 'Mining is globally disabled' });
            }

            // 2. Fetch User Status
            const user = await UserModel.findById(userId);
            if (!user) return res.status(404).json({ message: 'User not found' });

            if (user.is_blocked) {
                return res.status(403).json({ message: 'Account is blocked' });
            }

            if (user.is_mining_enabled === false || user.mining_paused === true) {
                return res.status(403).json({ message: 'Mining is disabled for your account' });
            }

            // 3. Check Cooldown (24 Hours)
            const ttl = await redis.ttl(`mining_cooldown:${userId}`);
            if (ttl > 0) {
                return res.status(400).json({
                    message: 'Mining session in cooldown',
                    timeLeft: ttl
                });
            }

            const DAILY_REWARD = parseFloat(settings.daily_reward || '1.0');
            const BOOST_REWARD = parseFloat(await SettingsModel.get('boost_reward_amount') || '0.1');
            const BOOSTS_USED = user.current_cycle_boosts || 0;

            const TOTAL_REWARD = DAILY_REWARD + (BOOSTS_USED * BOOST_REWARD);

            // Dynamic Cooldown Cycle
            const cycleHours = parseInt(await SettingsModel.get('mining_cycle_hours') || '24');
            const COOLDOWN_SECONDS = cycleHours * 60 * 60;

            // 4. Execute Mining (Transaction)
            await query('BEGIN');

            const updateRes = await query(
                `UPDATE users 
             SET at_balance = at_balance + $1,
                 mining_days_count = mining_days_count + CASE WHEN DATE(last_mined_at AT TIME ZONE 'UTC') < CURRENT_DATE OR last_mined_at IS NULL THEN 1 ELSE 0 END,
                 mining_sessions_count = mining_sessions_count + 1,
                 last_mined_at = NOW(),
                 current_cycle_boosts = 0
             WHERE id = $2 AND (last_mined_at IS NULL OR last_mined_at <= NOW() - ($3 || ' hours')::interval)`,
                [TOTAL_REWARD, userId, cycleHours]
            );

            if (updateRes.rowCount === 0) {
                throw new Error('Mining gap security: Cooldown period must be respected.');
            }

            // 5. Log to MongoDB
            const dateStr = new Date().toISOString().split('T')[0];
            const txHash = `mine_${userId}_${Date.now()}`;

            await MiningLog.create({
                userId,
                date: dateStr,
                reward: String(TOTAL_REWARD)
            });

            await Transaction.create({
                userId,
                txHash,
                type: 'mining',
                amount: String(TOTAL_REWARD),
                status: 'completed'
            });

            await query('COMMIT');

            // 6. Set Cooldown
            await redis.set(`mining_cooldown:${userId}`, 'active', 'EX', COOLDOWN_SECONDS);

            const isFirstTimeMining = user.last_mined_at === null;

            res.json({
                message: 'Claim successful',
                reward: TOTAL_REWARD,
                newBalance: parseFloat(user.at_balance) + TOTAL_REWARD
            });

            // 7. Post-Mining Hooks: Handle Referral Reward if first time
            if (isFirstTimeMining && user.referred_by) {
                // This is the unverified reward, now triggered by active participation (mining)
                ReferralController.applyReward(user.referred_by, userId, 'registration');
            }

        } finally {
            // Release the lock
            await redis.del(lockKey);
        }

    } catch (error: any) {
        await query('ROLLBACK');
        console.error('Mining Error:', error);
        res.status(500).json({ message: error.message || 'Mining process failed' });
    }
};

export const getMiningStatus = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;

        const settings = await SettingsModel.get('mining');
        const user = await UserModel.findById(userId);
        const ttl = await redis.ttl(`mining_cooldown:${userId}`);

        // Fetch boost settings
        const boostReward = parseFloat(await SettingsModel.get('boost_reward_amount') || '0.1');
        const boostEnabled = (await SettingsModel.get('boost_enabled')) === 'true';
        const maxBoosts = parseInt(await SettingsModel.get('daily_boost_max') || '3');

        const dailyReward = parseFloat(settings?.daily_reward || '1.0');
        const currentCycleBoosts = user?.current_cycle_boosts || 0;
        const currentYield = dailyReward + (currentCycleBoosts * boostReward);

        res.json({
            canMine: (ttl <= 0 && settings?.active && !user?.mining_paused),
            timeLeft: ttl > 0 ? ttl : 0,
            dailyReward: dailyReward,
            isGloballyActive: settings?.active || false,
            userMiningPaused: user?.mining_paused || false,
            // New Boost info
            boostReward,
            boostEnabled,
            maxBoosts,
            currentCycleBoosts,
            currentYield,
            bonusRate: parseFloat(user?.mining_bonus_rate || 0) // kept for compatibility if needed
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to fetch mining status' });
    }
};

export const claimBoost = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        const lockKey = `boost_lock:${userId}`;

        // Acquisition lock to prevent concurrent boost spamming
        const lockAcquired = await redis.set(lockKey, 'locked', 'EX', 5, 'NX');
        if (!lockAcquired) {
            return res.status(429).json({ message: 'Request already in progress' });
        }

        try {
            const user = await UserModel.findById(userId);

            if (!user) return res.status(404).json({ message: 'User not found' });

            const boostEnabled = (await SettingsModel.get('boost_enabled')) === 'true';
            if (!boostEnabled) {
                return res.status(403).json({ message: 'Boost feature is currently disabled' });
            }

            const maxBoosts = parseInt(await SettingsModel.get('daily_boost_max') || '3');
            const currentBoosts = user.current_cycle_boosts || 0;

            if (currentBoosts >= maxBoosts) {
                return res.status(400).json({ message: 'Maximum boosts for this cycle already used' });
            }

            // Apply boost
            await query('BEGIN');
            await query(
                `UPDATE users 
             SET current_cycle_boosts = current_cycle_boosts + 1
             WHERE id = $1`,
                [userId]
            );
            await query('COMMIT');

            const boostReward = parseFloat(await SettingsModel.get('boost_reward_amount') || '0.1');

            res.json({
                message: 'Boost applied successfully!',
                boostReward: boostReward,
                currentCycleBoosts: currentBoosts + 1
            });

        } finally {
            await redis.del(lockKey);
        }

    } catch (error) {
        await query('ROLLBACK');
        console.error('Claim Boost Error:', error);
        res.status(500).json({ message: 'Failed to claim boost' });
    }
};

export const validateMining = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        const lockKey = `mining_lock:${userId}`;

        // 1. Check if a request is already in progress (Lock check)
        const isLocked = await redis.get(lockKey);
        if (isLocked) {
            return res.status(429).json({ message: 'Mining process already in progress' });
        }

        // 2. Fetch Global Settings
        const settings = await SettingsModel.get('mining');
        if (!settings || !settings.active) {
            return res.status(403).json({ message: 'Mining is globally disabled' });
        }

        // 3. Fetch User Status
        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.is_blocked) {
            return res.status(403).json({ message: 'Account is blocked' });
        }

        if (user.is_mining_enabled === false || user.mining_paused === true) {
            return res.status(403).json({ message: 'Mining is disabled for your account' });
        }

        // 4. Check Cooldown (24 Hours)
        const ttl = await redis.ttl(`mining_cooldown:${userId}`);
        if (ttl > 0) {
            return res.status(400).json({
                message: 'Mining session in cooldown',
                timeLeft: ttl
            });
        }

        res.json({ message: 'Validation successful', canProceed: true });

    } catch (error: any) {
        console.error('Validation Error:', error);
        res.status(500).json({ message: 'Validation failed' });
    }
};
