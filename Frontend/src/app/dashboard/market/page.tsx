'use client';

import { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp, ArrowUpRight, ArrowDownLeft,
    Search, ChevronRight, Loader2, RefreshCw
} from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMarketData } from '@/hooks/useMarketData';
import api from '@/lib/api';
import { TokenLogo } from '@/components/market/TokenLogo';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function MarketPage() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [allTokens, setAllTokens] = useState<any[]>([]);

    // Fetch Top 10
    const { data: topTokens, error: topError, isLoading: topLoading } = useSWR('/market/top?limit=10', fetcher, {
        refreshInterval: 30000
    });

    // Fetch List with Search
    const { data: listData, error: listError, isLoading: listLoading } = useSWR(
        `/market/list?page=${page}&limit=10${debouncedSearchTerm ? `&search=${debouncedSearchTerm}` : ''}`,
        fetcher
    );

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset when search term changes
    useEffect(() => {
        setPage(1);
        setAllTokens([]);
    }, [debouncedSearchTerm]);

    // Update list on load more
    useMemo(() => {
        if (listData?.data) {
            setAllTokens(prev => {
                const existing = new Set(prev.map(t => t.symbol));
                const filtered = listData.data.filter((t: any) => !existing.has(t.symbol));
                return [...prev, ...filtered];
            });
        }
    }, [listData]);

    // Live Socket Data for Tickers
    const activeSubs = useMemo(() => {
        const top = topTokens?.map((t: any) => ({ market: t.symbol, type: 'ticker' })) || [];
        const body = allTokens.map((t: any) => ({ market: t.symbol, type: 'ticker' })) || [];
        // Unique subs by market
        const unique = Array.from(new Map([...top, ...body].map(s => [s.market, s])).values());
        return unique;
    }, [topTokens, allTokens]);

    const liveData = useMarketData(activeSubs);

    const getLiveData = (symbol: string) => {
        return liveData[`ticker:${symbol}`];
    };


    const formatPrice = (price: string | number) => {
        const p = typeof price === 'string' ? parseFloat(price) : price;
        return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    };

    const formatChange = (change: string | number) => {
        const c = typeof change === 'string' ? parseFloat(change) : change;
        const percent = (c * 100).toFixed(2);
        return {
            val: `${c >= 0 ? '+' : ''}${percent}%`,
            isPositive: c >= 0
        };
    };

    return (
        <div className="max-w-7xl mx-auto px-6 py-10 w-full font-sans selection:bg-foreground selection:text-background text-foreground">
            {/* Header section styled like Wallet page */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8 w-full"
            >
                <div className="bg-card border border-border p-8 md:p-10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-5 transition-transform group-hover:scale-110 duration-700">
                        <TrendingUp className="w-[120px] h-[120px]" />
                    </div>

                    <div className="relative z-10 space-y-6">
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground mb-4">Ather Chain Market</p>
                            <h2 className="text-5xl md:text-6xl font-light tracking-tighter text-foreground">
                                Market <span className="text-muted-foreground"></span>
                            </h2>
                        </div>

                        <div className="pt-6 border-t border-border/50 inline-block">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-foreground uppercase">Live Exchange Feed</p>
                                    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Aggregated from Global Markets</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
                </div>

                {/* Top 10 Horizontal Scroll */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-mono uppercase tracking-[0.2em] font-bold">Market Leaders</h3>
                        <div className="h-px flex-1 bg-border mx-4 opacity-50" />
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide no-scrollbar">
                        {topLoading ? (
                            <div className="flex gap-4">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="min-w-[280px] h-[160px] bg-card border border-border animate-pulse" />
                                ))}
                            </div>
                        ) : (
                            topTokens?.map((token: any) => {
                                const live = getLiveData(token.symbol);
                                const currentPrice = live?.price || token.price;
                                const change = formatChange(live?.change || token.change);

                                return (
                                    <motion.div
                                        key={token.symbol}
                                        onClick={() => router.push(`/dashboard/market/${token.symbol}`)}
                                        className="min-w-[280px] bg-card border border-border p-6 cursor-pointer hover:border-foreground/30 transition-all group relative overflow-hidden"
                                    >
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="flex items-center gap-3">
                                                <TokenLogo symbol={token.symbol} />
                                                <div>
                                                    <h4 className="text-sm font-bold tracking-wide">{token.name}</h4>
                                                    <p className="text-[9px] font-mono text-muted-foreground uppercase">{token.symbol}</p>
                                                </div>
                                            </div>
                                            <div className={`flex items-center gap-1 ${change.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                {change.isPositive ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
                                                <span className="text-[10px] font-bold font-mono">{change.val}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-2xl font-light tracking-tighter">${formatPrice(currentPrice)}</p>
                                            <div className="flex justify-between items-end">
                                                <p className="text-[9px] font-mono text-muted-foreground uppercase opacity-60">Vol: ${parseFloat(token.vol).toLocaleString()}</p>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* All Market List Paginated */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                        <div className="bg-card border border-border flex items-center px-4 py-2 flex-1 max-w-md">
                            <Search className="w-4 h-4 text-muted-foreground mr-3" />
                            <input
                                type="text"
                                placeholder="Search all markets..."
                                className="bg-transparent border-none focus:ring-0 text-[11px] font-mono uppercase tracking-widest placeholder:text-muted-foreground/50 w-full"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-card border border-border overflow-hidden">
                        <div className="grid grid-cols-4 px-6 py-4 border-b border-border bg-secondary/20">
                            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Asset</span>
                            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest text-right">Price</span>
                            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest text-right">Change</span>
                            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest text-right">Action</span>
                        </div>

                        <div className="divide-y divide-border">
                            {allTokens.map((token: any) => {
                                const live = getLiveData(token.symbol);
                                const change = formatChange(live?.change || token.change);

                                return (
                                    <div
                                        key={token.symbol}
                                        onClick={() => router.push(`/dashboard/market/${token.symbol}`)}
                                        className="grid grid-cols-4 px-6 py-5 items-center hover:bg-secondary/30 transition-colors cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <TokenLogo symbol={token.symbol} size="sm" />
                                            <div>
                                                <p className="text-xs font-bold uppercase">{token.name}</p>
                                                <p className="text-[9px] font-mono text-muted-foreground uppercase">{token.symbol}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-mono font-bold">${formatPrice(live?.price || token.price)}</p>
                                        </div>
                                        <div className={`text-right ${change.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                            <p className="text-[10px] font-mono font-bold">{change.val}</p>
                                        </div>
                                        <div className="flex justify-end">
                                            <button className="p-2 border border-border hover:border-foreground/30 transition-colors">
                                                <ArrowUpRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {allTokens.length === 0 && !listLoading && (
                                <div className="p-12 text-center text-[10px] font-mono uppercase text-muted-foreground">
                                    No markets found for "{debouncedSearchTerm}"
                                </div>
                            )}
                        </div>

                        {listLoading && (
                            <div className="p-12 flex flex-col items-center gap-4 text-muted-foreground">
                                <Loader2 className="w-6 h-6 animate-spin" />
                                <p className="text-[10px] font-mono uppercase tracking-widest">Loading Market Data...</p>
                            </div>
                        )}

                        <div className="p-6 border-t border-border flex justify-between items-center bg-secondary/10">
                            <p className="text-[9px] font-mono text-muted-foreground uppercase">Showing {allTokens.length} Markets</p>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={listLoading}
                                className="px-6 py-2 border border-border text-[10px] font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-all disabled:opacity-50"
                            >
                                {listLoading ? 'Loading...' : 'Load More Markets'}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
