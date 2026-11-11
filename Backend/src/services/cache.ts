import IORedis from 'ioredis';
import { env } from '../config/env';

class CacheService {
    private client: IORedis;

    constructor() {
        this.client = new IORedis(env.REDIS_URL, {
            maxRetriesPerRequest: null,
        });

        this.client.on('error', (err) => {
            console.error('[Cache] Redis Error:', err);
        });
    }

    async get(key: string): Promise<any | null> {
        try {
            const data = await this.client.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`[Cache] Error getting key ${key}:`, error);
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
        try {
            const data = JSON.stringify(value);
            await this.client.set(key, data, 'EX', ttlSeconds);
            return true;
        } catch (error) {
            console.error(`[Cache] Error setting key ${key}:`, error);
            return false;
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.client.del(key);
        } catch (error) {
            console.error(`[Cache] Error deleting key ${key}:`, error);
        }
    }

    async clearPattern(pattern: string): Promise<void> {
        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(...keys);
            }
        } catch (error) {
            console.error(`[Cache] Error clearing pattern ${pattern}:`, error);
        }
    }
}

export const cache = new CacheService();
