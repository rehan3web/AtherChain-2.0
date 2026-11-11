import { query } from '../db/postgres';

export class SettingsModel {
    static async get(key: string) {
        const res = await query('SELECT value FROM system_settings WHERE key = $1', [key]);
        if (res.rows.length === 0) return null;
        return res.rows[0].value;
    }

    static async set(key: string, value: any) {
        await query(
            `INSERT INTO system_settings (key, value)
             VALUES ($1, $2)
             ON CONFLICT (key) DO UPDATE SET value = $2`,
            [key, JSON.stringify(value)]
        );
    }
}
