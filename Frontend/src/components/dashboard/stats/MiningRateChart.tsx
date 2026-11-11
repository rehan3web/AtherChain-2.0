"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Zap } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

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

export function MiningRateChart() {
    const [data, setData] = useState<{ time: string; rate: number }[]>([])

    useEffect(() => {
        // Initial Seed
        const initialData = []
        const now = new Date()

        for (let i = 15; i >= 0; i--) {
            const time = new Date(now.getTime() - i * 2000).toISOString()
            initialData.push({
                time,
                rate: 100 + (Math.random() * 20 - 10),
            })
        }

        setData(initialData)

        const interval = setInterval(() => {
            setData((prev) => {
                const newData = [...prev.slice(1)]
                newData.push({
                    time: new Date().toISOString(),
                    rate: 100 + (Math.random() * 20 - 10),
                })
                return newData
            })
        }, 2000)

        return () => clearInterval(interval)
    }, [])

    const chartConfig = {
        rate: {
            label: "Efficiency",
            color: "var(--primary)",
        },
    } satisfies ChartConfig

    const lastRate = data[data.length - 1]?.rate || 100

    return (
        <Card className="h-[full] flex flex-col gap-0 py-1.5">
            {/* Header */}
            <CardHeader className="pb-1 pt-1.5">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500 fill-amber-500" />
                    Mining Rate Performance
                </CardTitle>
                <CardDescription>
                    Real-time Hash Rate Efficiency
                </CardDescription>
            </CardHeader>

            {/* Chart */}
            <CardContent className="pb-0 pt-0">
                <ChartContainer config={chartConfig} className="h-[180px] w-full">
                    <AreaChart
                        data={data}
                        margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                    >
                        <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                            stroke="hsl(var(--border))"
                        />

                        <XAxis
                            dataKey="time"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={30}
                            tickFormatter={(value) => {
                                const d = new Date(value)
                                return d.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                    hour12: false,
                                })
                            }}
                            tick={{
                                fill: "hsl(var(--muted-foreground))",
                                fontSize: 10,
                            }}
                        />

                        <YAxis domain={[80, 120]} hide />

                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent indicator="dot" />}
                        />

                        <Area
                            dataKey="rate"
                            type="natural"
                            stroke="var(--primary)"
                            fill="var(--primary)"
                            fillOpacity={0.2}
                            strokeWidth={2}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ChartContainer>
            </CardContent>

            {/* Footer (No Gap Now) */}
<CardFooter className="mt-auto pt-0 pb-2">
                    <div className="grid gap-1">
                    <div className="flex items-center gap-2 leading-none font-medium text-primary">
                        Current Efficiency: {lastRate.toFixed(1)}%
                        <TrendingUp className="h-4 w-4" />
                    </div>
                    <div className="text-muted-foreground text-xs">
                        Optimal range: 90% - 110%
                    </div>
                </div>
            </CardFooter>
        </Card>
    )
}