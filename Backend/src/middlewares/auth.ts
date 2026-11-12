import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { query } from '../db/postgres';
import redis from '../db/redis';

export const auth = async (req: Request | any, res: Response, next: NextFunction) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    // console.log('[AUTH DEBUG] Token received:', token ? token.substring(0, 20) + '...' : 'NONE');

    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });


    try {
        const decoded: any = jwt.verify(token, env.JWT_SECRET);
        // console.log('[AUTH DEBUG] Decoded:', decoded);

        // Check Session Validity (Force Logout Support)
        const sessionId = decoded.sessionId;

        const management = decoded.scope === 'session_management';
        if (management && !(req.baseUrl === '/auth' &&
            ((req.method === 'GET' && req.path === '/sessions') ||
            (req.method === 'DELETE' && /^\/sessions\/[^/]+$/.test(req.path))))) {
            return res.status(403).json({ message: 'This token can only manage individual sessions.' });
        }

        let sessionActive = false;

        if (management) {
            sessionActive = true;
        } else if (sessionId) {
            // New Session Logic
            const sessionExists = await redis.exists(`session:${sessionId}`);
            sessionActive = sessionExists === 1;

            if (sessionActive) {
                // Update last active time (optional: debounce this to avoid too many writes)
                await redis.hset(`session:${sessionId}`, 'lastActive', new Date().toISOString());
                await redis.expire(`session:${sessionId}`, 7 * 24 * 60 * 60); // Refresh expiry
            }
        } else {
            // Fallback for old tokens (optional, or force logout)
            const oldSession = await redis.get(`session:${decoded.id}`);
            sessionActive = !!oldSession;
        }

        // console.log(`[AUTH DEBUG] Session for ${decoded.id}:`, sessionActive ? 'Active' : 'Expired');

        if (!sessionActive) {
            console.log(`[AUTH FAIL] Session not found for user ${decoded.id}`);
            return res.status(401).json({ message: 'Session expired or invalidated' });
        }

        // Check if user is blocked in DB
        const userRes = await query('SELECT is_blocked, block_reason FROM users WHERE id = $1', [decoded.id]);

        if (userRes.rows.length === 0) {
            return res.status(401).json({ message: 'User no longer exists' });
        }

        const user = userRes.rows[0];
        if (user.is_blocked) {
            return res.status(403).json({
                message: 'Your account has been blocked',
                code: 'USER_BLOCKED',
                reason: user.block_reason
            });
        }

        req.user = { ...decoded, ...user };
        next();
    } catch (err: any) {
        console.error('[AUTH ERROR]', err);
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token is not valid or expired' });
        }
        // For DB errors or Redis errors, return 500 so frontend doesn't logout
        return res.status(500).json({ message: 'Internal Server Error during auth check' });
    }
};
export const adminAuth = (req: Request | any, res: Response, next: NextFunction) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied. Admin only.' });
    }
};
