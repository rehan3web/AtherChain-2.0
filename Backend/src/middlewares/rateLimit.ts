import { Request, Response, NextFunction } from 'express';
import redis from '../db/redis';

/**
 * Simple fixed-window rate limiter backed by Redis.
 *
 * Keyed per authenticated user rather than per IP: the routes this guards all
 * sit behind `auth`, and per-IP would punish users behind shared NAT while
 * doing nothing against an attacker with a valid token and a proxy pool.
 */
export function rateLimit(options: { windowSeconds: number; max: number; bucket: string }) {
    const { windowSeconds, max, bucket } = options;

    return async (req: Request | any, res: Response, next: NextFunction) => {
        const identity = req.user?.id ?? req.ip;
        const key = `ratelimit:${bucket}:${identity}`;

        try {
            const hits = await redis.incr(key);
            if (hits === 1) {
                await redis.expire(key, windowSeconds);
            }

            if (hits > max) {
                const ttl = await redis.ttl(key);
                res.setHeader('Retry-After', String(Math.max(ttl, 1)));
                return res.status(429).json({
                    message: 'Too many requests. Please wait and try again.',
                    code: 'RATE_LIMITED',
                    retryAfter: Math.max(ttl, 1),
                });
            }

            return next();
        } catch (error) {
            // Fail open. Redis being down must not lock users out of their own
            // wallet — the limiter is a hardening measure, not an auth control,
            // and `auth` has already run by this point.
            console.error(`[rateLimit:${bucket}] Redis unavailable, allowing request:`, error);
            return next();
        }
    };
}
