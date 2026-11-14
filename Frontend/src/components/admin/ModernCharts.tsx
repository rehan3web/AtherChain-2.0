"use client"

import {
    Area,
    AreaChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    PieChart,
    Pie,
    Cell
} from "recharts"
import { useTheme } from "next-themes"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

export const ModernLineChart = ({ data }: { data: number[] }) => {
    const chartData = data.map((value, index) => ({ index, value }))

    return (
        <div className="h-[200px] w-full">
            <ChartContainer config={{
                value: {
                    label: "Value",
                    color: "hsl(var(--primary))",
                },
            }}>
                <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.1} />
                            <stop offset="100%" stopColor="var(--background)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis dataKey="index" hide />
                    <YAxis hide />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--primary)"
                        fill="url(#gradient)"
                        strokeWidth={2}
                    />
                </AreaChart>
            </ChartContainer>
        </div>
    )
}

export const ModernCircleChart = ({ percentage, label }: { percentage: number, label: string }) => {
    const data = [
        { name: "Value", value: percentage, fill: "var(--color-value)" },
        { name: "Remaining", value: 100 - percentage, fill: "var(--color-remaining)" },
    ]

    return (
        <div className="flex flex-col items-center justify-center">
            <div className="h-[200px] w-[200px] relative">
                <ChartContainer config={{
                    value: {
                        label: "Value",
                        color: "hsl(var(--primary))",
                    },
                    remaining: {
                        label: "Remaining",
                        color: "hsl(var(--muted))",
                    },
                }}>
                    <PieChart>
                        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                        />
                    </PieChart>
                </ChartContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <span className="text-3xl font-bold text-foreground">{percentage}%</span>
                </div>
            </div>
            <span className="mt-2 text-sm text-muted-foreground uppercase">{label}</span>
        </div>
    )
}
