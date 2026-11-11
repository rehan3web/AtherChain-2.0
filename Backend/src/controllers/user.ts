import { Request, Response } from 'express';
import { UserModel } from '../models/user';
import { WalletService } from '../services/wallet';
import { env } from '../config/env';
import { query } from '../db/postgres';

export const getProfile = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user?.id; // From middleware
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Fetch live balances
        let balanceATH = '0.0';
        let balanceWATH = '0.0';
        try {
            if (user.address && WalletService.isAddress(user.address)) {
                balanceATH = await WalletService.getBalance(user.address);
                balanceWATH = await WalletService.getTokenBalance(user.address, env.WATH_TOKEN_ADDRESS);
            }
        } catch (e) {
            console.error('Failed to fetch blockchain balances', e);
        }

        const { twofa_secret, ...safeUser } = user;

        res.json({
            ...safeUser,
            balance_ath: balanceATH,
            balance_wath: balanceWATH
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const registerPushToken = async (req: Request | any, res: Response) => {
    const userId = req.user?.id;
    const { expo_push_token } = req.body;
    console.log(`📡 [Push Token API] Request received for userId: ${userId}, token: ${expo_push_token}`);
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!expo_push_token) {
        console.log(`📡 [Push Token API] Rejected: token is missing`);
        return res.status(400).json({ message: 'expo_push_token is required' });
    }
    try {
        await query('UPDATE users SET expo_push_token = $1 WHERE id = $2', [expo_push_token, userId]);
        console.log(`📡 [Push Token API] Successfully updated database to: ${expo_push_token}`);
        res.json({ message: 'Push token registered' });
    } catch (error) {
        console.error('Register push token error:', error);
        res.status(500).json({ message: 'Failed to register push token' });
    }
};

