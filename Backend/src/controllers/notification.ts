import { Request, Response } from 'express';
import { query } from '../db/postgres';
import { PushSubscriptionModel } from '../models/PushSubscription';

export const getVapidPublicKey = async (req: Request, res: Response) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

export const subscribeUser = async (req: Request | any, res: Response) => {
    const { subscription } = req.body;
    const userId = req.user.id;

    if (!subscription) {
        return res.status(400).json({ message: 'Subscription data is required' });
    }

    try {
        await PushSubscriptionModel.createOrUpdate(userId, subscription);
        res.json({ message: 'Subscribed successfully' });
    } catch (error) {
        console.error('Subscription Error:', error);
        res.status(500).json({ message: 'Failed to subscribe' });
    }
};

export const toggleReminders = async (req: Request | any, res: Response) => {
    const { enabled } = req.body;
    const userId = req.user.id;

    try {
        await query('UPDATE users SET mining_reminders_enabled = $1 WHERE id = $2', [enabled, userId]);
        res.json({ message: `Reminders ${enabled ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
        console.error('Toggle Reminders Error:', error);
        res.status(500).json({ message: 'Failed to toggle reminders' });
    }
};

export const getNotificationPreferences = async (req: Request | any, res: Response) => {
    const userId = req.user.id;

    try {
        const resUser = await query('SELECT mining_reminders_enabled FROM users WHERE id = $1', [userId]);
        const user = resUser.rows[0];

        const resSub = await query('SELECT 1 FROM push_subscriptions WHERE user_id = $1', [userId]);
        const isSubscribed = resSub.rows.length > 0;

        res.json({
            remindersEnabled: user?.mining_reminders_enabled || false,
            isSubscribed: isSubscribed
        });
    } catch (error) {
        console.error('Get Preferences Error:', error);
        res.status(500).json({ message: 'Failed to get preferences' });
    }
};
