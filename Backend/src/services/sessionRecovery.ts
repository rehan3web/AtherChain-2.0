import jwt from 'jsonwebtoken';
import redis from '../db/redis';
import { env } from '../config/env';

export function sessionDetails(id: string, data: Record<string, string>) {
    return { id, device: data.device || 'Unknown Device', ip: data.ip, location: data.location,
        loginTime: data.loginTime, lastActive: data.lastActive };
}

export async function getSessionRecovery(user: { id: string; role: string }) {
    const ids = await redis.smembers(`user_sessions:${user.id}`);
    const sessions = [];
    for (const id of ids) {
        const data = await redis.hgetall(`session:${id}`);
        if (Object.keys(data).length) sessions.push(sessionDetails(id, data));
        else await redis.srem(`user_sessions:${user.id}`, id);
    }
    if (sessions.length < 2) return null;
    return {
        message: 'Only 2 active sessions are allowed. Remove one to continue.',
        code: 'SESSION_LIMIT_EXCEEDED', sessions, userId: user.id,
        sessionManagementToken: jwt.sign(
            { id: user.id, role: user.role, scope: 'session_management' },
            env.JWT_SECRET, { expiresIn: '10m' }
        ),
    };
}
