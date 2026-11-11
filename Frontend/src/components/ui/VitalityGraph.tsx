import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis } from 'recharts';

const data = [
  { time: '00', value: 40 },
  { time: '01', value: 35 },
  { time: '02', value: 55 },
  { time: '03', value: 45 },
  { time: '04', value: 70 },
  { time: '05', value: 65 },
  { time: '06', value: 85 },
  { time: '07', value: 80 },
  { time: '08', value: 95 },
  { time: '09', value: 90 },
];

export const VitalityGraph = () => {
  return (
    <div className="h-[120px] w-full mt-4 -ml-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="currentColor" stopOpacity={0.1} />
              <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="time"
            hide
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            hide
            domain={[0, 100]}
          />
          <Area
            className="text-foreground"
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={1}
            fillOpacity={1}
            fill="url(#colorValue)"
            isAnimationActive={true}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
