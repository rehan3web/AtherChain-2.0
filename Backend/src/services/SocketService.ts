import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import redis from '../db/redis';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

class SocketService {
    private io: SocketIOServer | null = null;

    public init(server: HTTPServer) {
        this.io = new SocketIOServer(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            },
            transports: ['websocket', 'polling']
        });

        console.log('🔌 Socket.io initialized');

        // Optional: Add Auth Middleware for Sockets
        this.io.use((socket, next) => {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
            if (!token) return next();

            try {
                const decoded = jwt.verify(token, env.JWT_SECRET);
                (socket as any).user = decoded;
                next();
            } catch (err) {
                // We allow unauthenticated connections for market data, 
                // but specific rooms might check for (socket as any).user
                next();
            }
        });

        return this.io;
    }

    public getIO(): SocketIOServer {
        if (!this.io) {
            throw new Error('Socket.io not initialized. Call init(server) first.');
        }
        return this.io;
    }
}

export default new SocketService();
