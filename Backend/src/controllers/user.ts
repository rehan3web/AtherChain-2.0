import { Request, Response } from 'express';
import { UserModel } from '../models/user';
import { WalletService } from '../services/wallet';
import { query } from '../db/postgres';
import { isExpoPushToken } from '../services/expoPush';

export const getProfile = async (req: Request | any, res: Response) => {
    try {
        const userId = req.user?.id; // From middleware
        if (!userId) return res.status(401).json({ message: 'Unauthorized' });

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const balanceATH = user.address ? await WalletService.getBalance(user.address) : '0.0';

        const { twofa_secret, ...safeUser } = user;

        res.json({
            ...safeUser,
            balance_ath: balanceATH
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const registerPushToken = async (req: Request | any, res: Response) => {
    const userId = req.user?.id;
    const { expo_push_token } = req.body;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!isExpoPushToken(expo_push_token)) {
        return res.status(400).json({ message: 'A valid Expo push token is required' });
    }
    try {
        await query('UPDATE users SET expo_push_token = $1 WHERE id = $2', [expo_push_token, userId]);
        res.json({ message: 'Push token registered' });
    } catch (error) {
        console.error('Register push token error:', error);
        res.status(500).json({ message: 'Failed to register push token' });
    }
};

