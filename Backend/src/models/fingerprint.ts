
import { query } from '../db/postgres';

export interface DeviceFingerprint {
    visitor_id: string;
    user_id: string;
    ip_address: string;
    user_agent: string;
    device_type: string;
    browser?: string;
    os?: string;
    screen_resolution?: string;
    components_json?: any;
    created_at: Date;
    is_blocked: boolean;
}

export const FingerprintModel = {
    // Link a user to a fingerprint
    create: async (data: Partial<DeviceFingerprint>) => {
        const text = `
            INSERT INTO device_fingerprints (
                visitor_id, user_id, ip_address, user_agent, device_type,
                browser, os, screen_resolution, components_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        const values = [
            data.visitor_id, data.user_id, data.ip_address, data.user_agent, data.device_type,
            data.browser, data.os, data.screen_resolution,
            data.components_json ? JSON.stringify(data.components_json) : null
        ];
        const res = await query(text, values);
        return res.rows[0];
    },

    // Count accounts for a fingerprint
    countAccounts: async (visitorId: string) => {
        const text = 'SELECT COUNT(*) FROM device_fingerprints WHERE visitor_id = $1';
        const res = await query(text, [visitorId]);
        return parseInt(res.rows[0].count);
    },

    isBlocked: async (visitorId: string) => {
        const text = 'SELECT EXISTS(SELECT 1 FROM device_fingerprints WHERE visitor_id = $1 AND is_blocked = true)';
        const res = await query(text, [visitorId]);
        return res.rows[0].exists;
    },

    // Block a visitor ID (mark all entries or insert a specific block entry?)
    // This is currently handled primarily via Redis for temporary blocking.
};
