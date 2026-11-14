import axios from 'axios';
import { query } from '../db/postgres';

export function isExpoPushToken(value: unknown): value is string {
    return typeof value === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(value);
}

/** True means Expo accepted a ticket, not that the phone received it. */
export async function sendExpoPush(token: string, title: string, body: string, data: Record<string, unknown> = {}): Promise<boolean> {
    if (!isExpoPushToken(token)) return false;
    try {
        const response = await axios.post('https://exp.host/--/api/v2/push/send', {
            to: token, title, body, data, sound: 'default', priority: 'high', channelId: 'default',
        }, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 8000 });
        const ticket = response.data?.data;
        if (ticket?.status === 'ok' && typeof ticket.id === 'string' && ticket.id) return true;
        const code = ticket?.details?.error;
        if (code === 'DeviceNotRegistered') {
            await query('UPDATE users SET expo_push_token = NULL WHERE expo_push_token = $1', [token]);
        }
        console.error('Expo push rejected:', code || 'invalid_ticket');
    } catch {
        // Never log device tokens or Axios request/config objects.
        console.error('Expo push request failed');
    }
    return false;
}
