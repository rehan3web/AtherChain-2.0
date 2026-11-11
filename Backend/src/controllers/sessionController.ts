import { Request, Response } from 'express';
import redis from '../db/redis';

export const SessionController = {
    // Get all active sessions for the user
    getActiveSessions: async (req: Request | any, res: Response) => {
        try {
            const userId = req.user.id;
            const currentSessionId = req.user.sessionId;

            // Get all session IDs for the user
            const sessionIds = await redis.smembers(`user_sessions:${userId}`);
            const sessions: any[] = [];

            // Fetch details for each session
            for (const sessionId of sessionIds) {
                const sessionData = await redis.hgetall(`session:${sessionId}`);
                if (Object.keys(sessionData).length > 0) {
                    sessions.push({
                        id: sessionId,
                        ...sessionData,
                        isCurrent: sessionId === currentSessionId,
                        lastActive: sessionData.lastActive // or calculate relative time on frontend
                    });
                } else {
                    // Clean up stale session ID if key doesn't exist
                    await redis.srem(`user_sessions:${userId}`, sessionId);
                }
            }

            res.json({ sessions });
        } catch (error) {
            console.error('Get Active Sessions Error:', error);
            res.status(500).json({ message: 'Failed to fetch sessions' });
        }
    },

    // Remove a specific session
    removeSession: async (req: Request | any, res: Response) => {
        try {
            const userId = req.user.id;
            const { sessionId } = req.params;

            // Remove from Redis
            await redis.del(`session:${sessionId}`);
            await redis.srem(`user_sessions:${userId}`, sessionId);

            res.json({ message: 'Session removed successfully' });
        } catch (error) {
            console.error('Remove Session Error:', error);
            res.status(500).json({ message: 'Failed to remove session' });
        }
    },

    // Remove all sessions except current (or all if specified)
    removeAllSessions: async (req: Request | any, res: Response) => {
        try {
            const userId = req.user.id;
            const currentSessionId = req.user.sessionId;
            const { excludeCurrent } = req.body || {}; // Default true usually

            const sessionIds = await redis.smembers(`user_sessions:${userId}`);

            for (const sessionId of sessionIds) {
                if (excludeCurrent && sessionId === currentSessionId) continue;

                await redis.del(`session:${sessionId}`);
                await redis.srem(`user_sessions:${userId}`, sessionId);
            }

            res.json({ message: 'All other sessions removed' });
        } catch (error) {
            console.error('Remove All Sessions Error:', error);
            res.status(500).json({ message: 'Failed to remove sessions' });
        }
    }
};
