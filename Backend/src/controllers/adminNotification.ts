import { Request, Response } from 'express';
import pool from '../db/postgres';
import { z } from 'zod';
import axios from 'axios';

console.log('--- ADMIN NOTIFICATION CONTROLLER LOADED ---');

const broadcastSchema = z.object({
    title: z.string().min(1).max(255),
    message: z.string().min(1)
});

/**
 * Send an Expo push notification to a single device token.
 */
async function sendExpoPush(expoPushToken: string, title: string, body: string, data?: any) {
    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) return;
    try {
        await axios.post('https://exp.host/--/api/v2/push/send', {
            to: expoPushToken,
            title,
            body,
            data: data || {},
            sound: 'default',
            priority: 'high',
        }, {
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            timeout: 8000,
        });
    } catch (err) {
        console.error('Expo push error for token:', expoPushToken, err);
    }
}

/**
 * Send Expo push notifications in batches (Expo recommends max 100 per request).
 */
async function sendExpoPushBatch(tokens: string[], title: string, body: string, data?: any) {
    const messages = tokens
        .filter(t => t && t.startsWith('ExponentPushToken'))
        .map(token => ({
            to: token,
            title,
            body,
            data: data || {},
            sound: 'default' as const,
            priority: 'high' as const,
        }));

    if (messages.length === 0) return;

    // Expo API accepts up to 100 notifications per request
    const BATCH_SIZE = 100;
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);
        try {
            const res = await axios.post('https://exp.host/--/api/v2/push/send', batch, {
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                timeout: 15000,
            });
            console.log(`📨 Broadcast push batch ${Math.floor(i / BATCH_SIZE) + 1}: sent ${batch.length} notifications`);
            // Log any per-ticket errors from Expo (invalid tokens, etc.)
            const tickets = res.data?.data;
            if (Array.isArray(tickets)) {
                tickets.forEach((ticket: any, idx: number) => {
                    if (ticket.status === 'error') {
                        console.error(`  ❌ Token error: ${ticket.message} (detail: ${ticket.details?.error}) → ${batch[idx]?.to}`);
                    }
                });
            }
        } catch (err: any) {
            console.error(`Broadcast push batch error:`, err?.message || err);
        }
    }
}

export const sendBroadcast = async (req: Request, res: Response) => {
    try {
        const parseResult = broadcastSchema.safeParse(req.body);

        if (!parseResult.success) {
            return res.status(400).json({ message: 'Invalid input', errors: parseResult.error.issues });
        }

        const { title, message } = parseResult.data;

        // 1. Save notification to database
        const result = await pool.query(
            `INSERT INTO notifications (title, message, type) VALUES ($1, $2, 'broadcast') RETURNING *`,
            [title, message]
        );

        // 2. Fetch all users with a registered Expo push token
        const tokenResult = await pool.query(
            `SELECT expo_push_token FROM users WHERE expo_push_token IS NOT NULL AND expo_push_token != ''`
        );

        const tokens: string[] = tokenResult.rows.map((r: any) => r.expo_push_token);
        console.log(`📢 Broadcasting to ${tokens.length} devices...`);

        // 3. Send push notifications in background (don't block the response)
        sendExpoPushBatch(tokens, title, message, { type: 'broadcast', notificationId: result.rows[0].id })
            .then(() => console.log('✅ Broadcast push complete'))
            .catch((err) => console.error('❌ Broadcast push failed:', err));

        res.status(201).json({
            message: 'Broadcast sent successfully',
            notification: result.rows[0],
            devicesTargeted: tokens.length,
        });
    } catch (error: any) {
        console.error('Broadcast Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Manual Test Push Notification — Send a test push to a specific user (by userId)
 * or to all registered Expo tokens if no userId is provided.
 * POST /admin/notifications/test-push
 * Body: { userId?: string, title?: string, message?: string }
 */
const testPushSchema = z.object({
    userId: z.string().optional(),
    title: z.string().optional(),
    message: z.string().optional(),
});

export const testPush = async (req: Request, res: Response) => {
    try {
        const parsed = testPushSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
        }

        const { userId, title, message } = parsed.data;
        const pushTitle = title || '🔔 Test Notification';
        const pushBody = message || 'This is a test push notification from AtherChain Admin.';

        let tokens: string[] = [];

        if (userId) {
            // Send to a specific user
            const result = await pool.query(
                `SELECT expo_push_token FROM users WHERE id = $1 AND expo_push_token IS NOT NULL AND expo_push_token != ''`,
                [userId]
            );
            tokens = result.rows.map((r: any) => r.expo_push_token);
            if (tokens.length === 0) {
                return res.status(404).json({ message: 'User has no registered push token' });
            }
        } else {
            // Send to ALL registered tokens
            const result = await pool.query(
                `SELECT expo_push_token FROM users WHERE expo_push_token IS NOT NULL AND expo_push_token != ''`
            );
            tokens = result.rows.map((r: any) => r.expo_push_token);
        }

        console.log(`🧪 Test push to ${tokens.length} device(s)...`);

        // Send in background
        sendExpoPushBatch(tokens, pushTitle, pushBody, { type: 'test' })
            .then(() => console.log('✅ Test push complete'))
            .catch((err) => console.error('❌ Test push failed:', err));

        res.json({
            message: 'Test push sent',
            devicesTargeted: tokens.length,
        });
    } catch (error: any) {
        console.error('Test Push Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Manually trigger the mining completion reminder check (same logic as the cron).
 * POST /admin/notifications/trigger-mining-reminders
 */
export const triggerMiningReminders = async (req: Request, res: Response) => {
    try {
        const { SettingsModel } = require('../models/settings');
        const redis = require('../db/redis').default;

        const cycleHours = parseInt(await SettingsModel.get('mining_cycle_hours') || '24');

        const result = await pool.query(`
            SELECT u.id, u.username, u.last_mined_at, u.expo_push_token
            FROM users u
            WHERE u.last_mined_at IS NOT NULL
            AND u.expo_push_token IS NOT NULL
            AND u.expo_push_token != ''
            AND u.last_mined_at + ($1 || ' hours')::INTERVAL <= NOW()
            AND u.is_blocked = FALSE
            AND (u.mining_paused IS NULL OR u.mining_paused = FALSE)
        `, [cycleHours]);

        console.log(`🧪 Manual mining reminder trigger: ${result.rows.length} eligible users`);

        let sentCount = 0;
        let failCount = 0;
        const details: { userId: string; username: string; success: boolean }[] = [];

        for (const row of result.rows) {
            const token = row.expo_push_token;
            if (!token || !token.startsWith('ExponentPushToken')) {
                failCount++;
                details.push({ userId: row.id, username: row.username, success: false });
                continue;
            }

            try {
                await axios.post('https://exp.host/--/api/v2/push/send', {
                    to: token,
                    title: '⛏️ Mining Complete!',
                    body: `Hey ${row.username || 'Miner'}, your mining cycle is done! Claim your ATH rewards now.`,
                    data: { type: 'mining_complete', screen: '/(tabs)' },
                    sound: 'default',
                    priority: 'high',
                    channelId: 'default',
                }, {
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    timeout: 8000,
                });

                await pool.query('UPDATE users SET last_reminder_sent_at = NOW() WHERE id = $1', [row.id]);
                sentCount++;
                details.push({ userId: row.id, username: row.username, success: true });
            } catch (err: any) {
                failCount++;
                details.push({ userId: row.id, username: row.username, success: false });
                console.error(`Push failed for ${row.username}:`, err?.message);
            }
        }

        res.json({
            message: 'Mining reminder trigger complete',
            eligibleUsers: result.rows.length,
            sent: sentCount,
            failed: failCount,
            details,
        });
    } catch (error: any) {
        console.error('Trigger Mining Reminders Error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

