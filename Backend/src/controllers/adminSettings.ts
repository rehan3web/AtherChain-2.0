import { Request, Response } from 'express';
import { query } from '../db/postgres';
import { cache } from '../services/cache';

// key in system_settings: 'mining', 'swap', 'referral'
export const getSettings = async (req: Request, res: Response) => {
    try {
        const result = await query('SELECT * FROM system_settings');
        const settings: any = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching settings' });
    }
};

export const updateSettings = async (req: Request, res: Response) => {
    const { key, value } = req.body;

    const allowedKeys = ['mining', 'swap', 'transfer', 'referral', 'boost_referral_limit', 'boost_reward_amount', 'boost_enabled', 'maintenance_mode', 'maintenance_until', 'mining_cycle_hours'];
    if (!allowedKeys.includes(key)) {
        return res.status(400).json({ message: 'Invalid setting key' });
    }

    try {
        await query(
            `INSERT INTO system_settings (key, value) VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2`,
            [key, JSON.stringify(value)]
        );

        if (key === 'swap') {
            await cache.del('swap_settings');
        }

        res.json({ message: 'Settings updated' });
    } catch (error) {
        console.error('Update Settings Error:', error);
        res.status(500).json({ message: 'Update failed' });
    }
};

export const updateBoostSettings = async (req: Request, res: Response) => {
    const { rewardAmount, maxBoosts, enabled } = req.body;

    try {
        await query('BEGIN');

        await query(
            `INSERT INTO system_settings (key, value) VALUES ('boost_reward_amount', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1`,
            [JSON.stringify(rewardAmount || "0.1")]
        );

        await query(
            `INSERT INTO system_settings (key, value) VALUES ('daily_boost_max', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1`,
            [JSON.stringify(maxBoosts || "3")]
        );

        await query(
            `INSERT INTO system_settings (key, value) VALUES ('boost_enabled', $1)
             ON CONFLICT (key) DO UPDATE SET value = $1`,
            [JSON.stringify(enabled === false ? "false" : "true")]
        );

        await query('COMMIT');
        res.json({ message: 'Boost settings updated' });
    } catch (error) {
        await query('ROLLBACK');
        console.error('Boost Update Error:', error);
        res.status(500).json({ message: 'Update failed' });
    }
};
