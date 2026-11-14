"use client"

import * as React from "react"
import useSWR from 'swr'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import api from '@/lib/api'
import { useMarketData } from '@/hooks/useMarketData'
import { cn } from "@/lib/utils"

const fetcher = (url: string) => api.get(url).then(res => res.data)

export function MarketTicker() {
    const { data: topTokens, isLoading } = useSWR('/market/top?limit=8', fetcher, {
        refreshInterval: 60000 // Refresh list every minute
    })

    const activeSubs = React.useMemo(() => {
        return topTokens?.map((t: any) => ({ market: t.symbol, type: 'ticker' })) || []
    }, [topTokens])

    const liveData = useMarketData(activeSubs)

    const formatPrice = (price: string | number) => {
        const p = typeof price === 'string' ? parseFloat(price) : price
        return p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
    }

    const formatChange = (change: string | number) => {
        const c = typeof change === 'string' ? parseFloat(change) : change
        const percent = (c * 100).toFixed(2)
        return {
            val: `${c >= 0 ? '+' : ''}${percent}%`,
            isPositive: c >= 0
        }
    }

    if (isLoading || !topTokens) {
        return (
            <div className="h-8 bg-muted/30 border-b border-border flex items-center px-4 overflow-hidden">
                <div className="flex gap-8 animate-pulse">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-3 w-24 bg-muted/50 rounded-full" />
                    ))}
                </div>
            </div>
        )
    }

    // Duplicate items for infinite scroll effect
    const tickerItems = [...topTokens, ...topTokens]

    return (
        <div className="h-8 w-full bg-muted/20 border-b border-border flex items-center overflow-hidden relative group shrink-0">
            <motion.div
                className="flex items-center gap-12 whitespace-nowrap px-4"
                animate={{
                    x: ["0%", "-50%"]
                }}
                transition={{
                    x: {
                        repeat: Infinity,
                        repeatType: "loop",
                        duration: 30,
                        ease: "linear"
                    }
                }}
                whileHover={{ animationPlayState: "paused" }}
            >
                {tickerItems.map((token: any, index: number) => {
                    const live = liveData[`ticker:${token.symbol}`]
                    const currentPrice = live?.price || token.price
                    const change = formatChange(live?.change || token.change)

                    return (
                        <div key={`${token.symbol}-${index}`} className="flex items-center gap-2 text-[11px] font-medium tracking-tight">
                            <span className="font-bold uppercase tracking-wider text-foreground">{token.symbol}</span>
                            <span className="font-mono text-muted-foreground/80">${formatPrice(currentPrice)}</span>
                            <span className={cn(
                                "font-bold font-mono text-[10px]",
                                change.isPositive ? "text-green-500" : "text-red-500"
                            )}>
                                {change.val}
                            </span>
                            <span className="ml-8 text-muted-foreground/30 font-light">|</span>
                        </div>
                    )
                })}
            </motion.div>
            <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-background/50 to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background/50 to-transparent pointer-events-none" />
        </div>
    )
}
