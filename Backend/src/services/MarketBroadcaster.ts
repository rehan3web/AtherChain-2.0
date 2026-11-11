import { Server as SocketIOServer, Socket } from 'socket.io';
import redis from '../db/redis';
import KucoinService from './KucoinService';
import SocketService from './SocketService';

class MarketBroadcaster {
    private io: SocketIOServer | null = null;
    private redisPub: any;
    private redisSub: any;
    private socketSubs: Map<string, Set<string>> = new Map();
    private tickerBatch: Map<string, any> = new Map();

    constructor() {
        this.redisPub = redis.duplicate();
        this.redisSub = redis.duplicate();

        // Start ticker batch broadcaster (100ms interval)
        setInterval(() => this.flushTickerBatch(), 100);
    }

    public init() {
        this.io = SocketService.getIO();

        this.io.on('connection', (socket: Socket) => {
            this.socketSubs.set(socket.id, new Set());

            socket.on('subscribe', async ({ market, type, timeframe }) => {
                const room = timeframe ? `${type}:${market}:${timeframe}` : `${type}:${market}`;
                socket.join(room);
                this.socketSubs.get(socket.id)?.add(JSON.stringify({ market, type, timeframe }));
                await this.incrementViewers(market, type, timeframe);
            });

            socket.on('unsubscribe', async ({ market, type, timeframe }) => {
                const room = timeframe ? `${type}:${market}:${timeframe}` : `${type}:${market}`;
                socket.leave(room);
                this.socketSubs.get(socket.id)?.delete(JSON.stringify({ market, type, timeframe }));
                await this.decrementViewers(market, type, timeframe);
            });

            socket.on('disconnect', async () => {
                const subs = this.socketSubs.get(socket.id);
                if (subs) {
                    for (const subStr of subs) {
                        try {
                            const { market, type, timeframe } = JSON.parse(subStr);
                            await this.decrementViewers(market, type, timeframe);
                        } catch (e) { }
                    }
                    this.socketSubs.delete(socket.id);
                }
            });
        });

        // Redis Sub for horizontal scaling
        this.redisSub.psubscribe('market:*');
        this.redisSub.on('pmessage', (pattern: string, channel: string, message: string) => {
            if (this.io) {
                const room = channel.replace('market:', '');
                const data = JSON.parse(message);
                // console.log(`📦 Redis PMessage for ${room}`);
                if (data.type === 'ticker') {
                    this.tickerBatch.set(room, data);
                } else {
                    this.io.to(room).emit('market_update', data);
                }
            }
        });
    }

    private flushTickerBatch() {
        if (!this.io || this.tickerBatch.size === 0) return;
        this.tickerBatch.forEach((data, room) => {
            this.io?.to(room).emit('market_update', data);
        });
        this.tickerBatch.clear();
    }

    private async incrementViewers(market: string, type: string = 'ticker', timeframe?: string) {
        const key = timeframe ? `viewers:${type}:${market}:${timeframe}` : `viewers:${type}:${market}`;
        await redis.incr(key);
        // Always try to subscribe, KucoinService handles idempotency locally
        await KucoinService.subscribe(market, type, timeframe);
    }

    private async decrementViewers(market: string, type: string = 'ticker', timeframe?: string) {
        const key = timeframe ? `viewers:${type}:${market}:${timeframe}` : `viewers:${type}:${market}`;
        const count = await redis.decr(key);
        if (count <= 0) {
            await redis.set(key, 0);
            await KucoinService.unsubscribe(market, type, timeframe);
        }
    }

    public broadcast(market: string, data: any) {
        this.redisPub.publish(`market:${market}`, JSON.stringify(data));
    }
}

export default new MarketBroadcaster();
