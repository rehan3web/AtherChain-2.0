"use client"

import { TrendingUp, TrendingDown, Activity } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"

interface StatsChartProps {
    title: string;
    description?: string;
    data: { date: string; volume: number }[];
    lineColor?: string;
    emptyMessage?: string;
}

export function StatsChart({ title, description, data, lineColor = "var(--primary)", emptyMessage = "No activity recorded" }: StatsChartProps) {
    // Fill empty data if none exists
    const chartData = data && data.length > 0 ? data : [
        { date: "Day 1", volume: 0 },
        { date: "Day 2", volume: 0 },
        { date: "Day 3", volume: 0 },
        { date: "Day 4", volume: 0 },
        { date: "Day 5", volume: 0 },
        { date: "Day 6", volume: 0 },
        { date: "Day 7", volume: 0 },
    ];

    const chartConfig = {
        volume: {
            label: "Volume",
            color: lineColor,
        },
    } satisfies ChartConfig

    // Calculate trend
    const lastValue = chartData[chartData.length - 1]?.volume || 0;
    const prevValue = chartData.length > 1 ? (chartData[chartData.length - 2]?.volume || 0) : 0;
    const trend = lastValue - prevValue;
    const isUp = trend >= 0;
    const percentChange = prevValue !== 0 ? ((trend / prevValue) * 100).toFixed(1) : (trend !== 0 ? "100" : "0.0");

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    {title}
                </CardTitle>
                {description && <CardDescription>{description}</CardDescription>}
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer config={chartConfig} className="h-[200px] w-full">
                    <AreaChart
                        accessibilityLayer
                        data={chartData}
                        margin={{
                            left: 0,
                            right: 0,
                            top: 10,
                            bottom: 0
                        }}
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            tickFormatter={(value) => value.length > 5 ? value.slice(5) : value} // Show MM-DD or shorter
                            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="line" />}
                        />
                        <Area
                            dataKey="volume"
                            type="natural"
                            fill={lineColor}
                            fillOpacity={0.2}
                            stroke={lineColor}
                            strokeWidth={2}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col items-start gap-2 text-sm pt-0">
                <div className="flex w-full items-start gap-2">
                    <div className="grid gap-1">
                        <div className="flex items-center gap-2 leading-none font-medium">
                            {data.length > 0 ? (
                                <>
                                    {isUp ? "Trending up" : "Trending down"} by {Math.abs(Number(percentChange))}% this period
                                    {isUp ? <TrendingUp className="h-4 w-4 text-emerald-500" /> : <TrendingDown className="h-4 w-4 text-rose-500" />}
                                </>
                            ) : (
                                <span className="text-muted-foreground">{emptyMessage}</span>
                            )}
                        </div>
                        {data.length > 0 && (
                            <div className="text-muted-foreground flex items-center gap-1 leading-none text-xs">
                                Recent volume: {lastValue.toFixed(2)} ATH
                            </div>
                        )}
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}
