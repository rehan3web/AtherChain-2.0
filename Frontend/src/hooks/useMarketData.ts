import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { SOCKET_URL } from '@/lib/socket-url';

export function useMarketData(subs: { market: string, type: string, timeframe?: string }[]) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [marketData, setMarketData] = useState<Record<string, any>>({});

    useEffect(() => {
        const newSocket = io(SOCKET_URL);
        setSocket(newSocket);

        newSocket.on('connect', () => {
            console.log('✅ Connected to Market WebSocket');
            subs.forEach(sub => {
                newSocket.emit('subscribe', sub);
            });
        });

        newSocket.on('market_update', (data) => {
            const key = data.timeframe ? `${data.type}:${data.symbol}:${data.timeframe}` : `${data.type}:${data.symbol || data.market}`;
            setMarketData(prev => ({
                ...prev,
                [key]: data
            }));
        });

        return () => {
            subs.forEach(sub => {
                newSocket.emit('unsubscribe', sub);
            });
            newSocket.disconnect();
        };
    }, [JSON.stringify(subs)]);

    return marketData;
}
