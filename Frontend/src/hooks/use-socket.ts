import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { SOCKET_URL } from '@/lib/socket-url';

export const useSocket = () => {
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!socketRef.current) {
            const token = localStorage.getItem('token') || localStorage.getItem('admin_token');

            socketRef.current = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket', 'polling']
            });

            socketRef.current.on('connect', () => {
                setConnected(true);
                // console.log('✅ Connected to WebSocket');
            });

            socketRef.current.on('disconnect', () => {
                setConnected(false);
                // console.log('❌ Disconnected from WebSocket');
            });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, []);

    return {
        socket: socketRef.current,
        connected
    };
};
