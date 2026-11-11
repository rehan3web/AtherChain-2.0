import { query } from '../db/postgres';
import { NotificationService } from '../services/notificationService';
import { PushSubscriptionModel } from '../models/PushSubscription';
import pool from '../db/postgres';

const triggerNow = async (username: string) => {
    try {
        console.log(`🎯 Triggering notification for user: ${username}`);

        const userRes = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (userRes.rows.length === 0) {
            console.log('❌ User not found');
            return;
        }
        const userId = userRes.rows[0].id;

        const sub = await PushSubscriptionModel.findByUserId(userId);
        if (!sub) {
            console.log('❌ No push subscription found');
            return;
        }

        const payload = {
            title: 'Claim your ATH! ⛏️',
            body: `Hey ${username}, your mining cycle is complete. Claim now!`,
            icon: '/link.png',
            data: { url: '/dashboard/mining' }
        };

        const success = await NotificationService.sendPushNotification(sub.subscription, payload);
        console.log(success ? '🚀 Notification sent!' : '❌ Failed to send');

    } catch (error) {
        console.error(error);
    } finally {
        pool.end();
        process.exit(0);
    }
};

const targetUsername = process.argv[2] || 'rehanweb3';
triggerNow(targetUsername);
