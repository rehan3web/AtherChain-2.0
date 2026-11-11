import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { cache } from '../services/cache';
import SocketService from '../services/SocketService';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const QRAuthController = {
    // 1. Create QR Session
    createSession: async (req: Request, res: Response) => {
        try {
            const sessionId = uuidv4();
            const qrToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = Date.now() + 120 * 1000; // 2 minutes

            // Store session and token mapping in cache
            await cache.set(`qr_session:${sessionId}`, { status: 'pending', qrToken }, 120);
            await cache.set(`qr_token:${qrToken}`, sessionId, 120);

            res.json({
                success: true,
                sessionId,
                qrToken,
                expiresAt
            });
        } catch (error) {
            console.error('[QR Auth] Create Session Error:', error);
            res.status(500).json({ success: false, message: 'Failed to create QR session' });
        }
    },

    // 2. Get QR Session Status
    getStatus: async (req: Request, res: Response) => {
        try {
            const { sessionId } = req.params;
            const sessionData = await cache.get(`qr_session:${sessionId}`);

            if (!sessionData) {
                return res.json({ status: 'expired' });
            }

            res.json({ status: sessionData.status });
        } catch (error) {
            console.error('[QR Auth] Get Status Error:', error);
            res.status(500).json({ success: false, message: 'Failed to get QR session status' });
        }
    },

    // 3. Approve QR Session (Called from Mobile App)
    approveSession: async (req: Request, res: Response) => {
        try {
            const { qrToken } = req.body;
            const user = (req as any).user; // Set by auth middleware

            if (!user) {
                return res.status(401).json({ success: false, message: 'Unauthorized' });
            }

            if (!qrToken) {
                return res.status(400).json({ success: false, message: 'QR Token is required' });
            }

            const sessionId = await cache.get(`qr_token:${qrToken}`);
            
            if (!sessionId) {
                return res.status(400).json({ success: false, message: 'Invalid or expired QR token' });
            }

            const sessionData = await cache.get(`qr_session:${sessionId}`);
            if (!sessionData || sessionData.status !== 'pending') {
                return res.status(400).json({ success: false, message: 'Session is no longer pending' });
            }

            // Generate a real session ID for the user
            const sessionUuid = uuidv4();

            // Generate JWT for the web client
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role, sessionId: sessionUuid },
                env.JWT_SECRET,
                { expiresIn: '7d' }
            );

            // Store Session in Redis (Matches authController.ts)
            const userAgent = req.headers['user-agent'] || 'QR Scanner (Mobile)';
            const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';
            const sessionDataRedis = {
                device: userAgent,
                ip: String(ip),
                location: 'Unknown',
                loginTime: new Date().toISOString(),
                lastActive: new Date().toISOString(),
                token: token
            };

            const redis = (await import('../db/redis')).default;
            await redis.hmset(`session:${sessionUuid}`, sessionDataRedis);
            await redis.expire(`session:${sessionUuid}`, 7 * 24 * 60 * 60);
            await redis.sadd(`user_sessions:${user.id}`, sessionUuid);

            // Update QR session status
            await cache.set(`qr_session:${sessionId}`, { status: 'approved', token }, 120);

            // Notify Web Client via Socket.io globally on a specific event name
            const io = SocketService.getIO();
            io.emit(`qr_login_approved_${sessionId}`, {
                success: true,
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    avatar: user.avatar,
                    role: user.role
                }
            });

            // Clean up the token mapping so it can't be reused
            await cache.del(`qr_token:${qrToken}`);

            res.json({ success: true, message: 'Login approved successfully' });
        } catch (error) {
            console.error('[QR Auth] Approve Session Error:', error);
            res.status(500).json({ success: false, message: 'Failed to approve QR session' });
        }
    }
};
