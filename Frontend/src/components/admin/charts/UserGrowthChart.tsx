'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export function UserGrowthChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-[300px] border border-white/5 bg-white/[0.02] text-white/20 font-mono text-xs uppercase tracking-widest">
                NO_GROWTH_DATA_INDEXED
            </div>
        );
    }

    const formattedData = data.map(item => {
        const date = new Date(item.date);
        return {
            ...item,
            displayDate: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
        };
    });

    const chartConfig = {
        count: {
            label: "USERS",
            color: "rgb(255, 255, 255)",
        },
    };

    return (
        <div className="h-[300px] w-full">
            <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="rgb(255, 255, 255)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="rgb(255, 255, 255)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                    <XAxis
                        dataKey="displayDate"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        ticks={[0, 4, 8, 12, 16]}
                        domain={[0, 16]}
                        tick={{ fill: 'rgba(255, 255, 255, 0.4)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
                    />
                    <ChartTooltip
                        content={<ChartTooltipContent className="bg-background text-foreground border border-white/10 rounded-none font-mono text-[10px] uppercase shadow-2xl" />}
                    />
                    <Area
                        type="monotone"
                        dataKey="count"
                        stroke="rgb(255, 255, 255)"
                        fillOpacity={1}
                        strokeWidth={1.5}
                        fill="url(#colorGrowth)"
                        animationDuration={1500}
                    />
                </AreaChart>
            </ChartContainer>
        </div>
    );
}
