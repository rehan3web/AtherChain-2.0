import cron from 'node-cron';
import { query } from '../db/postgres';
import { SettingsModel } from '../models/settings';
import redis from '../db/redis';
import axios from 'axios';

/**
 * Send Expo push notification to a single token.
 */
async function sendExpoPushToToken(token: string, title: string, body: string, data?: any) {
    if (!token || !token.startsWith('ExponentPushToken')) return false;
    try {
        const res = await axios.post('https://exp.host/--/api/v2/push/send', {
            to: token,
            title,
            body,
            data: data || {},
            sound: 'default',
            priority: 'high',
            channelId: 'default',
        }, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            timeout: 8000,
        });
        const ticket = res.data?.data;
        if (ticket?.status === 'error') {
            console.error(`  ❌ Push error: ${ticket.message} → ${token}`);
            return false;
        }
        return true;
    } catch (err: any) {
        console.error('Expo push error:', token, err?.message || err);
        return false;
    }
}

export const initNotificationTask = () => {
    // ─── Mining Completion Reminder Cron ─────────────────────────────────────
    // Runs every 1 hour — checks which users have completed their mining cycle
    // and sends them an Expo push notification to claim their rewards.
    cron.schedule('0 * * * *', async () => {
        console.log('⛏️🔔 [Cron] Running Mining Completion Reminder Task...');
        try {
            const cycleHours = parseInt(await SettingsModel.get('mining_cycle_hours') || '24');

            // Find users whose mining cycle has completed:
            // 1. last_mined_at + cycleHours <= NOW (mining timer expired)
            // 2. They have an Expo push token registered
            // 3. They haven't been reminded in the last 1 hour (using 50 minutes to be safe from cron scheduling skews)
            //    (last_reminder_sent_at IS NULL or last_reminder_sent_at <= NOW() - INTERVAL '50 minutes')
            const res = await query(`
                SELECT u.id, u.username, u.last_mined_at, u.expo_push_token
                FROM users u
                WHERE u.last_mined_at IS NOT NULL
                AND u.expo_push_token IS NOT NULL
                AND u.expo_push_token != ''
                AND u.last_mined_at + ($1 || ' hours')::INTERVAL <= NOW()
                AND (u.last_reminder_sent_at IS NULL OR u.last_reminder_sent_at <= NOW() - INTERVAL '50 minutes')
                AND u.is_blocked = FALSE
                AND (u.mining_paused IS NULL OR u.mining_paused = FALSE)
            `, [cycleHours]);

            console.log(`  Found ${res.rows.length} users with completed mining cycle.`);

            let sentCount = 0;
            let failCount = 0;

            for (const row of res.rows) {
                // Double-check via Redis that cooldown has actually expired
                const ttl = await redis.ttl(`mining_cooldown:${row.id}`);
                if (ttl > 0) {
                    // Still in cooldown according to Redis, skip
                    continue;
                }

                const success = await sendExpoPushToToken(
                    row.expo_push_token,
                    '⛏️ Mining Complete!',
                    `Hey ${row.username || 'Miner'}, your mining cycle is done! Claim your ATH rewards now.`,
                    { type: 'mining_complete', screen: '/(tabs)' }
                );

                if (success) {
                    // Update last_reminder_sent_at so we don't spam them
                    await query('UPDATE users SET last_reminder_sent_at = NOW() WHERE id = $1', [row.id]);
                    sentCount++;
                } else {
                    failCount++;
                }
            }

            console.log(`  ✅ Mining reminders sent: ${sentCount}, failed: ${failCount}`);
        } catch (error) {
            console.error('❌ Error in Mining Completion Cron:', error);
        }
    });

    console.log('⏰ Mining completion cron scheduled (every 1 hour).');
};
