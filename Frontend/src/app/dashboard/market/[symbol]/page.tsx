'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { motion } from 'framer-motion';
import {
    ArrowLeft, TrendingUp, TrendingDown,
    Activity, ArrowUpRight, ArrowDownLeft,
    Clock, Loader2, RefreshCw
} from 'lucide-react';
import api from '@/lib/api';
import { TokenLogo } from '@/components/market/TokenLogo';
import { useMarketData } from '@/hooks/useMarketData';
import dynamic from 'next/dynamic';
const TradingViewChart = dynamic(() => import('@/components/market/TradingViewChart').then(mod => mod.TradingViewChart), {
    loading: () => (
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-mono text-[10px] uppercase">Retrieving chart engine...</p>
        </div>
    ),
    ssr: false
});

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function TokenDetailPage() {
    const params = useParams();
    const symbol = (params?.symbol as string)?.toUpperCase();
    const router = useRouter();
    const [timeframe, setTimeframe] = useState('1hour');

    // Live Socket Data
    const subs = useMemo(() => [
        { market: symbol, type: 'ticker' },
        { market: symbol, type: 'candles', timeframe },
        { market: symbol, type: 'ob' },
        { market: symbol, type: 'trades' }
    ], [symbol, timeframe]);

    const liveData = useMarketData(subs);

    const ticker = liveData[`ticker:${symbol}`];
    const liveCandle = liveData[`candles:${symbol}:${timeframe}`];
    const liveOB = liveData[`ob:${symbol}`];
    const liveTrades = liveData[`trades:${symbol}`];

    // Fetch Candles (History)
    const { data: candleData, isLoading: candleLoading } = useSWR(
        symbol ? `/market/candles?symbol=${symbol}&type=${timeframe}` : null,
        fetcher
    );

    const [book, setBook] = useState<{ asks: any[], bids: any[] }>({ asks: [], bids: [] });

    // Fetch Orderbook (Initial Snapshot)
    const { data: obData, isLoading: obLoading } = useSWR(
        symbol ? `/market/orderbook/snapshot?symbol=${symbol}` : null,
        fetcher,
        {
            onSuccess: (data) => {
                if (data?.data) {
                    setBook({
                        asks: [...data.data.asks],
                        bids: [...data.data.bids]
                    });
                }
            }
        }
    );

    // Fetch 24h Stats (High, Low, Vol)
    const { data: statsData } = useSWR(
        symbol ? `/market/stats?symbol=${symbol}` : null,
        fetcher
    );

    // Handle Live Orderbook (Depth 5 Snapshot)
    useEffect(() => {
        const key = `ob:${symbol}`;
        const liveOB = liveData[key];

        if (!liveOB?.data) return;

        const { asks, bids } = liveOB.data;
        // Strictly use 5 items for consistency
        const newAsks = (asks || []).slice(0, 5);
        const newBids = (bids || []).slice(0, 5);

        // Simple equality check to avoid infinite loops if liveData contains other updates
        setBook(prev => {
            if (JSON.stringify(prev.asks) === JSON.stringify(newAsks) &&
                JSON.stringify(prev.bids) === JSON.stringify(newBids)) {
                return prev;
            }
            console.log(`📥 Live OB Updated for ${symbol}:`, { asks: newAsks.length, bids: newBids.length });
            return { asks: newAsks, bids: newBids };
        });
    }, [liveData[`ob:${symbol}`], symbol]);

    // Recent Trades State
    const [trades, setTrades] = useState<any[]>([]);

    // Fetch Recent Trades (Initial)
    const { data: tradeData, isLoading: tradeLoading } = useSWR(
        symbol ? `/market/histories?symbol=${symbol}` : null,
        fetcher,
        {
            onSuccess: (data) => {
                if (data?.data) {
                    setTrades(data.data.slice(0, 50));
                }
            }
        }
    );

    // Handle Live Trades
    useEffect(() => {
        const key = `trades:${symbol}`;
        const liveTrade = liveData[key];

        if (!liveTrade?.data) return;

        const newTrade = {
            time: liveTrade.data.time,
            side: liveTrade.data.side,
            price: liveTrade.data.price,
            size: liveTrade.data.size
        };

        setTrades(prev => {
            // Avoid duplicates if same trade message arrives
            if (prev[0] && prev[0].time === newTrade.time && prev[0].size === newTrade.size) return prev;
            return [newTrade, ...prev].slice(0, 50);
        });
    }, [liveData[`trades:${symbol}`], symbol]);

    const formattedCandles = useMemo(() => {
        let base = [];
        if (candleData?.data) {
            base = candleData.data.slice(0, 100).reverse().map((c: any) => ({
                time: parseInt(c[0]), // Timestamp in seconds
                open: parseFloat(c[1]),
                close: parseFloat(c[2]),
                high: parseFloat(c[3]),
                low: parseFloat(c[4]),
                volume: parseFloat(c[5])
            }));
        }
        return base;
    }, [candleData]);

    const currentLiveCandle = useMemo(() => {
        if (!liveCandle?.data) return null;
        const c = liveCandle.data;
        return {
            time: parseInt(c[0]),
            open: parseFloat(c[1]),
            close: parseFloat(c[2]),
            high: parseFloat(c[3]),
            low: parseFloat(c[4]),
            volume: parseFloat(c[5])
        };
    }, [liveCandle]);

    const formatPrice = (p: any) => parseFloat(p || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });

    if (!symbol) return null;

    const baseSymbol = symbol.split('-')[0];

    return (
        <div className="max-w-7xl mx-auto px-6 py-10 w-full font-sans selection:bg-foreground selection:text-background text-foreground bg-background min-h-screen">
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-8"
            >
                {/* Header */}
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="p-3 border border-border hover:border-foreground/30 transition-all flex items-center gap-2 group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Back to Markets</span>
                    </button>

                    <div className="flex gap-2">
                        {['1min', '15min', '1hour', '1day'].map((tf) => (
                            <button
                                key={tf}
                                onClick={() => setTimeframe(tf)}
                                className={`px-4 py-1.5 border text-[10px] font-mono uppercase transition-all ${timeframe === tf ? 'bg-foreground text-background border-foreground' : 'border-border hover:border-foreground/30'
                                    }`}
                            >
                                {tf.replace('min', 'M').replace('hour', 'H').replace('day', 'D')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Price Summary Card */}
                <div className="bg-card border border-border p-8 relative overflow-hidden group">
                    {/* Glass effect gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-foreground/5 to-transparent pointer-events-none" />

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
                        <div>
                            <div className="flex items-center gap-6 mb-4">
                                <TokenLogo symbol={symbol} size="lg" />
                                <div>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground mb-1">{symbol} Live Market</p>
                                    <h2 className="text-5xl md:text-6xl font-light tracking-tighter">
                                        ${formatPrice(ticker?.price || formattedCandles[formattedCandles.length - 1]?.close)}
                                    </h2>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 border-t md:border-t-0 md:border-l border-border pt-6 md:pt-0 md:pl-8">
                            <div>
                                <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1">24h Change</p>
                                <p className={`text-sm font-bold font-mono ${(ticker?.change || statsData?.data?.changeRate || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {((ticker?.change || statsData?.data?.changeRate || 0) * 100).toFixed(2)}%
                                </p>
                            </div>
                            <div>
                                <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1">High</p>
                                <p className="text-sm font-bold font-mono text-foreground">${formatPrice(ticker?.high || statsData?.data?.high || 0)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1">Low</p>
                                <p className="text-sm font-bold font-mono text-foreground">${formatPrice(ticker?.low || statsData?.data?.low || 0)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-mono text-muted-foreground uppercase mb-1">24h Vol</p>
                                <p className="text-sm font-bold font-mono text-foreground">${parseFloat(ticker?.vol || statsData?.data?.volValue || 0).toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Chart Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-card border border-border p-6 h-[500px] flex flex-col">
                            <div className="flex items-center gap-3 mb-6">
                                <Activity className="w-4 h-4 text-muted-foreground" />
                                <h3 className="text-xs font-bold uppercase tracking-widest font-mono">Real-Time Activity</h3>
                            </div>

                            <div className="flex-1 w-full min-h-0">
                                {candleLoading ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
                                        <Loader2 className="w-8 h-8 animate-spin" />
                                        <p className="font-mono text-[10px] uppercase">Retrieving historical data...</p>
                                    </div>
                                ) : (
                                    <TradingViewChart
                                        data={formattedCandles}
                                        liveData={currentLiveCandle}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Recent Trades Table */}
                        <div className="bg-card border border-border overflow-hidden">
                            <div className="p-4 border-b border-border bg-secondary/20 font-mono text-[10px] font-bold uppercase tracking-widest">
                                Recent Market History
                            </div>
                            <div className="divide-y divide-border text-foreground">
                                {tradeLoading && trades.length === 0 ? (
                                    <div className="p-12 text-center text-[10px] font-mono uppercase text-muted-foreground animate-pulse">Syncing transactions...</div>
                                ) : (
                                    trades.slice(0, 10).map((trade: any, i: number) => (
                                        <div key={i} className="px-6 py-4 flex items-center justify-between text-[11px] font-mono">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-1 h-1 rounded-full ${trade.side === 'buy' ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <span className="text-muted-foreground">{new Date(parseInt(trade.time) / 1000000).toLocaleTimeString()}</span>
                                            </div>
                                            <div className="flex-1 flex justify-center gap-8">
                                                <span className={trade.side === 'buy' ? 'text-green-500' : 'text-red-500'}>
                                                    {trade.side.toUpperCase()}
                                                </span>
                                                <span className="font-bold">{trade.size} {baseSymbol}</span>
                                            </div>
                                            <span className="text-right font-bold">${trade.price}</span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Orderbook Column */}
                    <div className="space-y-6">
                        <div className="bg-card border border-border flex flex-col h-full">
                            <div className="p-4 border-b border-border bg-secondary/20 flex items-center justify-between">
                                <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">Limit Order Book</h3>
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin-slow" />
                                    <span className="text-[8px] font-mono text-muted-foreground uppercase">Live</span>
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col h-full">
                                {/* ASKS (Sells) - Red */}
                                <div className="flex flex-col-reverse divide-y divide-border/10 min-h-[160px]">
                                    {book.asks.slice(0, 5).map((ask: any, i: number) => (
                                        <div key={i} className="relative px-4 py-2 flex justify-between text-[11px] font-mono group">
                                            <div className="absolute inset-y-0 right-0 bg-red-500/5 transition-all group-hover:bg-red-500/10" style={{ width: `${Math.min((parseFloat(ask[1]) / (parseFloat(book.asks[0]?.[1]) || 1)) * 100, 100)}%` }} />
                                            <span className="text-red-500 relative z-10">{parseFloat(ask[0]).toFixed(4)}</span>
                                            <span className="text-muted-foreground relative z-10">{ask[1]}</span>
                                        </div>
                                    ))}
                                    {book.asks.length === 0 && (
                                        <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground uppercase font-mono animate-pulse">Waiting for asks...</div>
                                    )}
                                </div>

                                {/* Current Price Mid-Section */}
                                <div className="p-6 border-y border-border bg-secondary/30 flex flex-col items-center justify-center gap-1">
                                    <p className={`text-2xl font-bold font-mono tracking-tighter ${(ticker?.change || statsData?.data?.changeRate || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        ${formatPrice(ticker?.price || formattedCandles[formattedCandles.length - 1]?.close || statsData?.data?.last)}
                                    </p>
                                    <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-widest">Mid Market Price</p>
                                </div>

                                {/* BIDS (Buys) - Green */}
                                <div className="flex flex-col divide-y divide-border/10 min-h-[160px]">
                                    {book.bids.slice(0, 5).map((bid: any, i: number) => (
                                        <div key={i} className="relative px-4 py-2 flex justify-between text-[11px] font-mono group">
                                            <div className="absolute inset-y-0 right-0 bg-green-500/5 transition-all group-hover:bg-green-500/10" style={{ width: `${Math.min((parseFloat(bid[1]) / (parseFloat(book.bids[0]?.[1]) || 1)) * 100, 100)}%` }} />
                                            <span className="text-green-500 relative z-10">{parseFloat(bid[0]).toFixed(4)}</span>
                                            <span className="text-muted-foreground relative z-10">{bid[1]}</span>
                                        </div>
                                    ))}
                                    {book.bids.length === 0 && (
                                        <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground uppercase font-mono animate-pulse">Waiting for bids...</div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 border-t border-border bg-secondary/10 flex justify-between text-[8px] font-mono text-muted-foreground uppercase">
                                <span>Price (USDT)</span>
                                <span>Amount ({baseSymbol})</span>
                            </div>
                        </div>
                    </div>

                </div>
            </motion.div>
        </div>
    );
}
