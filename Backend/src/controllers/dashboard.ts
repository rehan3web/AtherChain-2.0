import { Request, Response } from 'express';
import { query } from '../db/postgres';
import MiningLog from '../models/MiningLog';
import Transaction from '../models/Transaction';
import redis from '../db/redis';
import { WalletService } from '../services/wallet';

export const getDashboardStats = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;

        // 1. Fetch Basic Data from Postgres (AT Balance from Users Table)
        const userRes = await query(
            `SELECT u.username, u.email, u.referral_code, u.at_balance, u.mining_paused, u.swap_paused, u.transfer_paused,
                    w.address 
             FROM users u
             LEFT JOIN wallets w ON u.id = w.user_id
             WHERE u.id = $1`,
            [userId]
        );

        if (userRes.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userData = userRes.rows[0];
        console.log(`[DASHBOARD_DEBUG] User Data Found:`, {
            username: userData.username,
            balance_at: userData.balance_at,
            address: userData.address
        });

        // 2 & 3 & 4. Fetch additional data in parallel
        const [balanceATH, miningTTL, referralRes] = await Promise.all([
            userData.address ? WalletService.getBalance(userData.address).catch(e => {
                console.warn('[DASHBOARD_DEBUG] ATH balance fetch failed:', e.message);
                return '0.00';
            }) : Promise.resolve('0.00'),
            redis.ttl(`mining_cooldown:${userId}`),
            query('SELECT COUNT(*) FROM users WHERE referrer_id = $1', [userId])
        ]);

        const totalReferrals = parseInt(referralRes.rows[0].count);

        // 5. Fetch Mining History for Graph (Last 7 Days)
        let miningHistory: any[] = [];
        try {
            // MongoDB aggregation or simple find
            // We want last 7 days.
            const logs = await MiningLog.find({ userId: String(userId) })
                .sort({ date: -1 })
                .limit(7);

            miningHistory = logs.map(r => ({
                date: r.date,
                reward: parseFloat(r.reward)
            })).reverse();

            console.log(`[DASHBOARD_DEBUG] Mining History Count: ${miningHistory.length}`);
        } catch (e: any) {
            console.warn('[DASHBOARD_DEBUG] MongoDB History fail:', e.message);
        }

        // Fallback for Graph if no history found
        if (miningHistory.length === 0) {
            const today = new Date();
            for (let i = 6; i >= 0; i--) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                miningHistory.push({
                    date: date.toISOString().split('T')[0],
                    reward: 0
                });
            }
        }

        // 6. Fetch Recent Transactions
        let recentTransactions: any[] = [];
        try {
            const txs = await Transaction.find({ userId: String(userId) })
                .sort({ createdAt: -1 })
                .limit(5);

            recentTransactions = txs.map(tx => ({
                tx_hash: tx.txHash,
                type: tx.type,
                amount: tx.amount,
                status: tx.status,
                created_at: tx.createdAt
            }));
            console.log(`[DASHBOARD_DEBUG] Recent TX Count: ${recentTransactions.length}`);
        } catch (e: any) {
            console.warn('[DASHBOARD_DEBUG] MongoDB TX fail:', e.message);
        }

        // 7. Get Protocols from Settings
        const miningSettings = await query('SELECT value FROM system_settings WHERE key = $1', ['mining']);
        const dailyReward = miningSettings.rows[0]?.value?.daily_reward || 100;
        const isMiningGlobal = miningSettings.rows[0]?.value?.active !== false;

        const swapSettings = await query('SELECT value FROM system_settings WHERE key = $1', ['swap']);
        const isSwapGlobal = swapSettings.rows[0]?.value?.active !== false;

        const transferSettings = await query('SELECT value FROM system_settings WHERE key = $1', ['transfer']);
        const isTransferGlobal = transferSettings.rows[0]?.value?.active !== false;

        res.json({
            user: {
                username: userData.username,
                email: userData.email,
                referralCode: userData.referral_code,
                balance_at: userData.at_balance ?? '0',
                balanceAT: userData.at_balance ?? '0',
                balanceATH: balanceATH,
                address: userData.address
            },
            mining: {
                canMine: miningTTL <= 0 && !userData.mining_paused && isMiningGlobal,
                timeLeft: miningTTL > 0 ? miningTTL : 0,
                dailyReward: dailyReward,
                isPaused: userData.mining_paused === true,
                isGloballyActive: isMiningGlobal
            },
            swap: {
                isPaused: userData.swap_paused === true,
                isGloballyActive: isSwapGlobal
            },
            transfer: {
                isPaused: userData.transfer_paused === true,
                isGloballyActive: isTransferGlobal
            },
            referrals: {
                total: totalReferrals
            },
            analytics: {
                miningHistory
            },
            recentTransactions
        });

    } catch (error) {
        console.error('[DASHBOARD_STATS] Fatal Error:', error);
        res.status(500).json({ message: 'Failed to fetch dashboard intelligence' });
    }
};

export const getUserStatistics = async (req: Request | any, res: Response) => {
    const userId = req.user.id;
    const cacheKey = `user_stats:${userId}`;

    try {
        // 1. Check Cache
        const cachedData = await redis.get(cacheKey);
        if (cachedData) {
            console.log(`[USER_STATS] Returning cached data for ${userId}`);
            return res.json(JSON.parse(cachedData));
        }

        // 2. Fetch fresh data if cache miss
        console.log(`[USER_STATS] Cache miss for ${userId}, fetching from DB`);

        // A. Mining History (Calendar Data)
        const miningLogs = await MiningLog.find({ userId: String(userId) }).select('date reward').sort({ date: 1 });
        const uniqueMiningDates = miningLogs.map(log => ({
            date: new Date(log.date).toISOString().split('T')[0],
            status: 'mined'
        }));

        // B. Swap Activity (Line Graph)
        const swapTxs = await Transaction.aggregate([
            { $match: { userId: String(userId), type: 'swap', status: 'completed' } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    volume: { $sum: { $toDouble: "$amount" } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // C. Transfer Activity (Line Graph)
        const transferTxs = await Transaction.aggregate([
            { $match: { userId: String(userId), type: { $in: ['send', 'receive', 'transfer'] }, status: 'completed' } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    volume: { $sum: { $toDouble: "$amount" } }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        const responseData = {
            miningCalendar: uniqueMiningDates,
            swapActivity: swapTxs.map(s => ({ date: s._id, volume: s.volume })),
            transferActivity: transferTxs.map(t => ({ date: t._id, volume: t.volume }))
        };

        // 3. Store in Cache (10 minutes = 600 seconds)
        await redis.setex(cacheKey, 600, JSON.stringify(responseData));

        res.json(responseData);

    } catch (error) {
        console.error('[USER_STATS] Error fetching statistics:', error);
        res.status(500).json({ message: 'Failed to fetch user statistics' });
    }
};
