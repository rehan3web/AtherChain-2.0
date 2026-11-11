import { Request, Response } from 'express';
import pool, { query } from '../db/postgres';
import Transaction from '../models/Transaction';
import { SettingsModel } from '../models/settings';
import { UserModel } from '../models/user';
import { SwapService } from '../services/swapService';
import { cache } from '../services/cache';
import redis from '../db/redis';

// Removed blockchain provider

export const getSwapRate = async (req: Request, res: Response) => {
    try {
        const cachedRate = await cache.get('swap_settings');
        if (cachedRate) return res.json(cachedRate);

        const settings = await SettingsModel.get('swap');
        if (!settings) return res.status(500).json({ message: 'Swap settings not found' });

        await cache.set('swap_settings', settings, 60); // Cache for 60s
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching rate' });
    }
};

export const executeSwap = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        const lockKey = `swap_lock:${userId}`;

        // Acquisition lock to prevent concurrent swap attempts (and cooldown bypass)
        const lockAcquired = await redis.set(lockKey, 'locked', 'EX', 10, 'NX');
        if (!lockAcquired) {
            return res.status(429).json({ message: 'Request already in progress' });
        }

        try {
            const { amountAT, fromToken = 'AT', toToken = 'ATH' } = req.body;

            if (!amountAT || amountAT <= 0) {
                return res.status(400).json({ message: 'Invalid amount' });
            }

            const isFixedPair = (fromToken === 'ATH' && toToken === 'WATH') || (fromToken === 'WATH' && toToken === 'ATH');

            if (!isFixedPair && (fromToken !== 'AT' || toToken !== 'ATH')) {
                return res.status(400).json({ message: 'Invalid swap pair' });
            }

            // 1. Get Settings & Global Status (Cached)
            let settings = await cache.get('swap_settings');
            if (!settings) {
                settings = await SettingsModel.get('swap');
                if (settings) await cache.set('swap_settings', settings, 60);
            }
            if (!settings || !settings.active) {
                return res.status(400).json({ message: 'Internal swap settings disabled' });
            }

            const isCooldownEnabled = settings.cooldown_enabled !== false; // Default to true if not set

            const isEnabledOnChain = await SwapService.isGlobalSwapEnabled();
            if (!isEnabledOnChain) {
                return res.status(400).json({ message: 'Contract swap is globally disabled' });
            }

            // 2. Fetch User & Check Cooldown (Cached Check)
            const cacheKey = `user_cooldown:${userId}`;
            const now = new Date();

            if (!isFixedPair && isCooldownEnabled) {
                const cachedCooldown = await cache.get(cacheKey);
                if (cachedCooldown && now < new Date(cachedCooldown)) {
                    const nextSwapAt = new Date(cachedCooldown);
                    const diff = nextSwapAt.getTime() - now.getTime();
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    return res.status(429).json({
                        message: 'Cooldown active',
                        nextSwapAt,
                        remaining: `${hours}h ${minutes}m`
                    });
                }
            }

            const user = await UserModel.findById(userId);
            if (!user) return res.status(404).json({ message: 'User not found' });

            if (user.kyc_status !== 'approved') {
                return res.status(403).json({ message: 'KYC Verification Required' });
            }

            if (user.swap_paused) {
                return res.status(403).json({ message: 'Swap Access Restricted: Your account swap protocol has been suspended by administration.' });
            }

            if (user.is_swap_enabled === false) {
                return res.status(403).json({ message: 'Swap is disabled for your account' });
            }

            // Cooldown check (Only for AT -> ATH)
            const nextSwapAt = user.next_swap_at ? new Date(user.next_swap_at) : null;
            if (!isFixedPair && isCooldownEnabled && nextSwapAt && now < nextSwapAt) {
                await cache.set(cacheKey, nextSwapAt.toISOString(), 300); // Sync cache for 5m
                const diff = nextSwapAt.getTime() - now.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                return res.status(429).json({
                    message: 'Cooldown active',
                    nextSwapAt,
                    remaining: `${hours}h ${minutes}m`
                });
            }

            // 3. Balance Checks
            if (fromToken === 'AT') {
                if (parseFloat(user.at_balance) < amountAT) {
                    return res.status(400).json({ message: 'Insufficient AT Balance' });
                }
            } else {
                const balanceATH = await SwapService.getATHBalance(user.address!);
                if (parseFloat(balanceATH) < amountAT) {
                    return res.status(400).json({ message: `Insufficient ${fromToken} Balance` });
                }
            }

            // 4. Execute Internal Swap
            const rate = isFixedPair ? 1 : settings.rate;
            const amountATH = amountAT * rate;

            try {
                if (fromToken === 'AT') {
                    await SwapService.swapATtoATH(userId, amountAT, rate);
                } else {
                    // Handle ATH <-> WATH if needed, otherwise skip for now
                    await SwapService.swapFixed(userId, amountAT, fromToken, toToken);
                }

                const txHash = `ATH_SWAP_${require('uuid').v4().replace(/-/g, '').toUpperCase()}`;

                // 5. Log Transaction
                const tx = await Transaction.create({
                    userId,
                    txHash,
                    type: 'swap',
                    amount: String(amountATH),
                    status: 'completed',
                    metadata: {
                        fromToken,
                        toToken,
                        fromAmount: amountAT,
                        toAmount: amountATH,
                        rate
                    }
                });

                res.json({
                    success: true,
                    status: 'completed',
                    message: 'Swap completed instantly',
                    txId: tx._id,
                    hash: txHash
                });

            } catch (error: any) {
                console.error('Swap Error:', error);
                res.status(500).json({ message: error.message || 'Swap failed' });
            }

        } finally {
            await redis.del(lockKey);
        }

    } catch (error: any) {
        console.error('Swap Process Error:', error);
        res.status(500).json({ message: error.message || 'Swap process failed' });
    }
};

export const getSwapStatus = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user.id;
        // Fetch latest swap transaction
        const lastSwap = await Transaction.findOne({ userId, type: 'swap' }).sort({ createdAt: -1 });

        if (!lastSwap) {
            return res.status(200).json(null);
        }

        res.json({
            id: lastSwap._id,
            status: lastSwap.status.toUpperCase(),
            txHash: lastSwap.txHash === 'pending' ? null : lastSwap.txHash,
            amount: lastSwap.amount,
            createdAt: lastSwap.createdAt,
            error: lastSwap.status === 'failed' ? lastSwap.metadata?.error : null
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching status' });
    }
};

