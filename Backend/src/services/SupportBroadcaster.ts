import { Server as SocketIOServer } from 'socket.io';
import redis from '../db/redis';

class SupportBroadcaster {
    private io: SocketIOServer | null = null;
    private redisPub: any;
    private redisSub: any;

    constructor() {
        this.redisPub = redis.duplicate();
        this.redisSub = redis.duplicate();
    }

    public init(io: SocketIOServer) {
        this.io = io;

        this.io.on('connection', (socket) => {
            socket.on('join_ticket', (ticketId: string) => {
                // console.log(`👤 Socket ${socket.id} joining ticket room: ${ticketId}`);
                socket.join(`ticket:${ticketId}`);
            });

            socket.on('leave_ticket', (ticketId: string) => {
                // console.log(`👤 Socket ${socket.id} leaving ticket room: ${ticketId}`);
                socket.leave(`ticket:${ticketId}`);
            });
        });

        // Redis Sub for horizontal scaling (Support)
        this.redisSub.psubscribe('support:ticket:*');
        this.redisSub.on('pmessage', (pattern: string, channel: string, message: string) => {
            if (this.io) {
                const ticketId = channel.replace('support:ticket:', '');
                const data = JSON.parse(message);
                this.io.to(`ticket:${ticketId}`).emit('new_message', data);
            }
        });
    }

    /**
     * Broadcast a new message to a ticket room
     * @param ticketId Ticket UUID
     * @param message Message object (usually from ticket_messages table)
     */
    public broadcastMessage(ticketId: string, message: any) {
        this.redisPub.publish(`support:ticket:${ticketId}`, JSON.stringify(message));
    }
}

export default new SupportBroadcaster();
