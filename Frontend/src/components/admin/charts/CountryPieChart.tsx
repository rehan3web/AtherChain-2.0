'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export function CountryPieChart({ data }: { data: any[] }) {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-[300px] text-muted-foreground">No country data available</div>;
    }

    const chartData = data.map((item, index) => ({
        ...item,
        fill: COLORS[index % COLORS.length]
    }));

    return (
        <ResponsiveContainer width="100%" height={300}>
            <PieChart>
                <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} stroke="rgba(0,0,0,0)" />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}
