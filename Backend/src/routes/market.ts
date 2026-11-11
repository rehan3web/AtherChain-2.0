import { Router } from 'express';
import axios from 'axios';

const router = Router();

// Cache for top tokens to avoid hitting Kucoin too hard
let topTokensCache: any[] = [];
let lastCacheUpdate = 0;

router.get('/top', async (req: any, res) => {
    try {
        const now = Date.now();
        if (now - lastCacheUpdate > 60000 || topTokensCache.length === 0) {
            const response = await axios.get('https://api.kucoin.com/api/v1/market/allTickers');
            const tickers = response.data.data.ticker;

            // Filter and sort by volume or market cap if available
            // For now, let's take some popular ones
            const popularSymbols = ['BTC-USDT', 'ETH-USDT', 'KCS-USDT', 'SOL-USDT', 'BNB-USDT', 'XRP-USDT', 'ADA-USDT', 'DOT-USDT', 'MATIC-USDT', 'LINK-USDT'];

            topTokensCache = tickers.filter((t: any) => popularSymbols.includes(t.symbol))
                .map((t: any) => ({
                    symbol: t.symbol,
                    name: t.symbol.split('-')[0],
                    price: t.last,
                    change: t.changeRate,
                    vol: t.volValue,
                    marketCap: 'N/A' // Kucoin ticker doesn't provide market cap directly
                }));

            lastCacheUpdate = now;
        }

        const limit = parseInt(req.query.limit as string) || 10;
        res.json(topTokensCache.slice(0, limit));
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch top market data' });
    }
});

router.get('/list', async (req: any, res) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const search = (req.query.search as string || '').toUpperCase();

        const response = await axios.get('https://api.kucoin.com/api/v1/market/allTickers');
        let tickers = response.data.data.ticker;

        // Apply server-side search filter
        if (search) {
            tickers = tickers.filter((t: any) =>
                t.symbol.toUpperCase().includes(search) ||
                t.symbol.split('-')[0].toUpperCase().includes(search)
            );
        }

        const start = (page - 1) * limit;
        const pagedTickers = tickers.slice(start, start + limit).map((t: any) => ({
            symbol: t.symbol,
            name: t.symbol.split('-')[0],
            price: t.last,
            change: t.changeRate,
            vol: t.volValue
        }));

        res.json({
            data: pagedTickers,
            meta: {
                page,
                limit,
                total: tickers.length
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch market list' });
    }
});

router.get('/candles', async (req: any, res) => {
    try {
        const { symbol, type } = req.query;
        const response = await axios.get(`https://api.kucoin.com/api/v1/market/candles?symbol=${symbol}&type=${type}`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Failed to proxy candles' });
    }
});

router.get('/stats', async (req: any, res) => {
    try {
        const { symbol } = req.query;
        const response = await axios.get(`https://api.kucoin.com/api/v1/market/stats?symbol=${symbol}`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch stats' });
    }
});

router.get('/orderbook/snapshot', async (req: any, res) => {
    try {
        const { symbol } = req.query;
        // Level 2 Full (Aggregated) 20 items, slice to 5 as requested
        const response = await axios.get(`https://api.kucoin.com/api/v1/market/orderbook/level2_20?symbol=${symbol}`);
        if (response.data?.data) {
            response.data.data.asks = response.data.data.asks.slice(0, 5);
            response.data.data.bids = response.data.data.bids.slice(0, 5);
        }
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Failed to proxy orderbook' });
    }
});

router.get('/histories', async (req: any, res) => {
    try {
        const { symbol } = req.query;
        const response = await axios.get(`https://api.kucoin.com/api/v1/market/histories?symbol=${symbol}`);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ message: 'Failed to proxy histories' });
    }
});

export default router;
