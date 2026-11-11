import WebSocket from 'ws';
import axios from 'axios';
import MarketBroadcaster from './MarketBroadcaster';

class KucoinService {
    private ws: WebSocket | null = null;
    private token: string = '';
    private endpoint: string = '';
    private pingInterval: any;
    private subscriptions: Set<string> = new Set();
    private isConnecting: boolean = false;

    constructor() { }

    private async getToken() {
        try {
            const response = await axios.post('https://api.kucoin.com/api/v1/bullet-public');
            this.token = response.data.data.token;
            this.endpoint = response.data.data.instanceServers[0].endpoint;
        } catch (error) {
            console.error('❌ Failed to get Kucoin WS token:', error);
            throw error;
        }
    }

    public async connect() {
        if (this.ws || this.isConnecting) return;
        this.isConnecting = true;

        try {
            await this.getToken();
            const url = `${this.endpoint}?token=${this.token}`;
            this.ws = new WebSocket(url);

            this.ws.on('open', () => {
                console.log('✅ Connected to Kucoin WebSocket');
                this.isConnecting = false;
                this.startPing();
                this.subscriptions.forEach(topic => this.sendSubscribe(topic));
            });

            this.ws.on('message', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'message') {
                    this.handleMessage(message);
                }
            });

            this.ws.on('close', () => {
                console.warn('⚠️ Kucoin WebSocket closed. Reconnecting...');
                this.cleanup();
                setTimeout(() => this.connect(), 5000);
            });

            this.ws.on('error', (err) => {
                console.error('❌ Kucoin WebSocket error:', err);
                this.ws?.close();
            });

        } catch (error) {
            this.isConnecting = false;
            setTimeout(() => this.connect(), 10000);
        }
    }

    private startPing() {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    id: Date.now(),
                    type: 'ping'
                }));
            }
        }, 20000);
    }

    private cleanup() {
        this.ws = null;
        if (this.pingInterval) clearInterval(this.pingInterval);
    }

    private handleMessage(msg: any) {
        const topic = msg.topic;
        const data = msg.data;

        if (topic.startsWith('/market/ticker:')) {
            const market = topic.split(':')[1];
            MarketBroadcaster.broadcast(`ticker:${market}`, {
                type: 'ticker',
                market,
                symbol: market,
                price: data.price,
                change: data.changeRate,
                vol: data.vol,
                high: data.high,
                low: data.low
            });
        } else if (topic.startsWith('/market/candles:')) {
            const parts = topic.split(':')[1].split('_');
            const symbol = parts[0];
            const timeframe = parts[1];
            MarketBroadcaster.broadcast(`candles:${symbol}:${timeframe}`, {
                type: 'candles',
                symbol,
                timeframe,
                data: data.candles
            });
        } else if (topic.startsWith('/spotMarket/level2Depth5:')) {
            const symbol = topic.split(':')[1];
            MarketBroadcaster.broadcast(`ob:${symbol}`, {
                type: 'ob',
                symbol,
                data
            });
        } else if (topic.startsWith('/market/match:')) {
            const symbol = topic.split(':')[1];
            MarketBroadcaster.broadcast(`trades:${symbol}`, {
                type: 'trades',
                symbol,
                data
            });
        }
    }

    public async subscribe(market: string, type: string = 'ticker', timeframe?: string) {
        const normalizedMarket = market.replace('/', '-').toUpperCase();

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            await this.connect();
        }

        let topic = '';
        if (type === 'ticker') topic = `/market/ticker:${normalizedMarket}`;
        else if (type === 'candles') topic = `/market/candles:${normalizedMarket}_${timeframe}`;
        else if (type === 'ob') topic = `/spotMarket/level2Depth5:${normalizedMarket}`;
        else if (type === 'trades') topic = `/market/match:${normalizedMarket}`;

        if (!topic) return;

        // If already subscribed in this process, no need to send WS message again
        if (this.subscriptions.has(topic)) return;

        this.subscriptions.add(topic);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendSubscribe(topic);
        }
    }

    public async unsubscribe(market: string, type: string = 'ticker', timeframe?: string) {
        let topic = '';
        if (type === 'ticker') topic = `/market/ticker:${market}`;
        else if (type === 'candles') topic = `/market/candles:${market}_${timeframe}`;
        else if (type === 'ob') topic = `/spotMarket/level2Depth5:${market}`;
        else if (type === 'trades') topic = `/market/match:${market}`;

        if (!topic) return;

        this.subscriptions.delete(topic);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                id: Date.now(),
                type: 'unsubscribe',
                topic: topic,
                privateChannel: false,
                response: true
            }));
        }
    }

    private sendSubscribe(topic: string) {
        if (this.ws) {
            this.ws.send(JSON.stringify({
                id: Date.now(),
                type: 'subscribe',
                topic: topic,
                privateChannel: false,
                response: true
            }));
        }
    }
}

export default new KucoinService();
