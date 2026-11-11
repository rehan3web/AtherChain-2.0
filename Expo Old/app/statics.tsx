import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgGrad,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

import Header from "@/components/Header";
import { useColors } from "@/hooks/useColors";
import { userApi } from "@/services/api";
import Skeleton from "@/components/Skeleton";

type CalendarEntry  = { date: string; status: string };
type ActivityEntry  = { date: string; volume: number };
type ChartPoint     = { label: string; value: number };

type StatsData = {
  miningCalendar:   CalendarEntry[];
  swapActivity:     ActivityEntry[];
  transferActivity: ActivityEntry[];
};

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function dayLabel(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" }).slice(0, 3);
}

function fillLastNDays(data: ActivityEntry[], n: number): ChartPoint[] {
  const map: Record<string, number> = {};
  for (const d of data) map[d.date] = d.volume;
  const result: ChartPoint[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    result.push({ label: dayLabel(key), value: map[key] ?? 0 });
  }
  return result;
}

function computeStreak(calendar: CalendarEntry[]): number {
  const dates = new Set(calendar.map((c) => c.date.split("T")[0]));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().split("T")[0];
    if (dates.has(key)) streak++;
    else break;
  }
  return streak;
}

function pctChange(data: ChartPoint[]): string {
  if (data.length < 2) return "";
  const recent = data.slice(-3).reduce((a, b) => a + b.value, 0);
  const prior  = data.slice(-6, -3).reduce((a, b) => a + b.value, 0);
  if (prior === 0 && recent === 0) return "";
  if (prior === 0) return "+100%";
  const pct = ((recent - prior) / prior) * 100;
  return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
}

function BarChart({ data, colors }: { data: ChartPoint[]; colors: any }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartH = 140;
  const barW   = 28;
  const gap    = 12;
  const totalW = data.length * (barW + gap) - gap;

  return (
    <Svg width={totalW} height={chartH + 28} viewBox={`0 0 ${totalW} ${chartH + 28}`}>
      <Defs>
        <SvgGrad id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity="1" />
          <Stop offset="1" stopColor={colors.primary} stopOpacity="0.25" />
        </SvgGrad>
      </Defs>
      {data.map((item, i) => {
        const h = item.value > 0 ? Math.max((item.value / maxVal) * chartH, 4) : 2;
        const x = i * (barW + gap);
        const y = chartH - h;
        return (
          <React.Fragment key={i}>
            <Rect
              x={x} y={y} width={barW} height={h} rx={6}
              fill={item.value > 0 ? "url(#barGrad)" : colors.border}
            />
            <SvgText
              x={x + barW / 2} y={chartH + 18}
              fontSize={10} fill={colors.mutedForeground}
              textAnchor="middle" fontWeight="500"
            >
              {item.label}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

function AreaChart({ data, colors }: { data: ChartPoint[]; colors: any }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartH = 130;
  const chartW = 280;
  const padX   = 6;
  const usableW = chartW - padX * 2;
  const step   = data.length > 1 ? usableW / (data.length - 1) : usableW;

  const points = data.map((item, i) => ({
    x: padX + i * step,
    y: chartH - (item.value / maxVal) * (chartH - 20) - 10,
  }));

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cx = (points[i - 1].x + points[i].x) / 2;
    linePath += ` C ${cx} ${points[i - 1].y}, ${cx} ${points[i].y}, ${points[i].x} ${points[i].y}`;
  }
  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x} ${chartH} L ${points[0].x} ${chartH} Z`;

  return (
    <Svg width={chartW} height={chartH + 28} viewBox={`0 0 ${chartW} ${chartH + 28}`}>
      <Defs>
        <SvgGrad id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.primary} stopOpacity="0.25" />
          <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
        </SvgGrad>
      </Defs>
      {[0, 1, 2, 3].map((i) => (
        <Line
          key={i}
          x1={0} y1={10 + i * ((chartH - 10) / 3)}
          x2={chartW} y2={10 + i * ((chartH - 10) / 3)}
          stroke={colors.border} strokeWidth={0.5} strokeDasharray="4,4"
        />
      ))}
      <Path d={areaPath} fill="url(#areaGrad)" />
      <Path d={linePath} stroke={colors.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {points.map((p, i) => (
        <React.Fragment key={i}>
          <Circle cx={p.x} cy={p.y} r={3.5} fill={colors.primary} />
          <SvgText
            x={p.x} y={chartH + 18}
            fontSize={10} fill={colors.mutedForeground}
            textAnchor="middle" fontWeight="500"
          >
            {data[i].label}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );
}

function StatCard({ icon, label, value, loading, colors }: { icon: any; label: string; value: string; loading: boolean; colors: any }) {
  return (
    <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: colors.primaryPale }]}>
        <Feather name={icon} size={16} color={colors.primary} />
      </View>
      {loading ? (
        <Skeleton width={60} height={16} borderRadius={4} style={{ marginVertical: 2 }} />
      ) : (
        <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      )}
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );
}

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

function MiningCalendar({ calendar, loading, colors }: { calendar: CalendarEntry[]; loading: boolean; colors: any }) {
  const today      = new Date();
  const year       = today.getFullYear();
  const month      = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay   = new Date(year, month, 1).getDay();
  const todayDate  = today.getDate();
  const monthName  = today.toLocaleString("default", { month: "long", year: "numeric" });

  const activeDays = new Set<number>(
    calendar.flatMap((c) => {
      const d = new Date(c.date);
      if (d.getFullYear() === year && d.getMonth() === month) return [d.getDate()];
      return [];
    })
  );

  const grid: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) grid.push(null);
  for (let d = 1; d <= daysInMonth; d++) grid.push(d);

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryPale }]}>
            <Feather name="calendar" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Mining Calendar</Text>
        </View>
        {loading ? (
          <Skeleton width={110} height={24} borderRadius={9999} />
        ) : (
          <View style={[styles.monthPill, { backgroundColor: colors.primaryPale }]}>
            <Text style={[styles.monthText, { color: colors.primary }]}>{monthName}</Text>
          </View>
        )}
      </View>

      <View style={styles.calRow}>
        {DAYS.map((d, i) => (
          <View key={i} style={styles.calCell}>
            <Text style={[styles.calDayHeader, { color: colors.mutedForeground }]}>{d}</Text>
          </View>
        ))}
      </View>

      {loading ? (
        Array.from({ length: 5 }).map((_, rowIdx) => (
          <View key={rowIdx} style={styles.calRow}>
            {Array.from({ length: 7 }).map((_, colIdx) => (
              <View key={colIdx} style={styles.calCell}>
                <Skeleton width={24} height={24} borderRadius={12} />
              </View>
            ))}
          </View>
        ))
      ) : (
        Array.from({ length: Math.ceil(grid.length / 7) }).map((_, rowIdx) => (
          <View key={rowIdx} style={styles.calRow}>
            {grid.slice(rowIdx * 7, rowIdx * 7 + 7).map((day, ci) => {
              const isToday  = day === todayDate;
              const isActive = day !== null && activeDays.has(day);
              return (
                <View key={ci} style={styles.calCell}>
                  {day !== null ? (
                    <View style={[
                      styles.calDay,
                      isToday  && { backgroundColor: colors.primary },
                      !isToday && isActive && { backgroundColor: colors.primaryPale },
                    ]}>
                      <Text style={[
                        styles.calDayText,
                        {
                          color: isToday
                            ? colors.primaryForeground
                            : isActive
                            ? colors.primary
                            : colors.mutedForeground,
                        },
                        isToday && { fontFamily: "Inter_700Bold" },
                      ]}>
                        {day}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
}

export default function StaticsScreen() {
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();
  const isWeb   = Platform.OS === "web";
  const topPad  = isWeb ? 60 : insets.top;

  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [stats,         setStats]         = useState<StatsData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [minedToday,    setMinedToday]    = useState("—");
  const [totalSwaps,    setTotalSwaps]    = useState("—");
  const [totalTransfers,setTotalTransfers]= useState("—");

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [statsData, dashData] = await Promise.all([
        userApi.statistics(),
        userApi.dashboardStats(),
      ]);

      setStats(statsData);

      const today = todayStr();
      const mh: { date: string; reward: number }[] = dashData?.analytics?.miningHistory ?? [];
      const todayEntry = mh.find((m: any) => String(m.date).startsWith(today));
      setMinedToday(todayEntry && todayEntry.reward > 0 ? `${todayEntry.reward.toFixed(2)} AT` : "0 AT");

      const sa: ActivityEntry[] = statsData?.swapActivity ?? [];
      const swapVol = sa.reduce((acc, s) => acc + s.volume, 0);
      setTotalSwaps(swapVol > 0 ? `${swapVol.toFixed(2)} AT` : `${sa.length} days`);

      const ta: ActivityEntry[] = statsData?.transferActivity ?? [];
      const transVol = ta.reduce((acc, t) => acc + t.volume, 0);
      setTotalTransfers(transVol > 0 ? `${transVol.toFixed(4)} ATH` : `${ta.length} days`);

    } catch (_) {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const swapChartData     = fillLastNDays(stats?.swapActivity     ?? [], 7);
  const transferChartData = fillLastNDays(stats?.transferActivity ?? [], 7);
  const streak            = computeStreak(stats?.miningCalendar   ?? []);
  const swapWeekTotal     = swapChartData.reduce((a, b) => a + b.value, 0);
  const transferWeekTotal = transferChartData.reduce((a, b) => a + b.value, 0);
  const swapChange        = pctChange(swapChartData);
  const transferChange    = pctChange(transferChartData);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Header />

        <View style={styles.titleRow}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: colors.foreground }]}>Statistics</Text>
            <Text style={[styles.pageSub, { color: colors.mutedForeground }]}>Track your mining & activity</Text>
          </View>
        </View>

            <View style={styles.statsGrid}>
              <StatCard icon="zap"    label="Mined Today"  value={minedToday}     loading={loading} colors={colors} />
              <StatCard icon="repeat" label="Total Swaps"  value={totalSwaps}     loading={loading} colors={colors} />
              <StatCard icon="send"   label="Transfers"    value={totalTransfers} loading={loading} colors={colors} />
            </View>

            <MiningCalendar calendar={stats?.miningCalendar ?? []} loading={loading} colors={colors} />

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.streakRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.streakLabel, { color: colors.mutedForeground }]}>Live Streak</Text>
                  {loading ? (
                    <View style={{ marginTop: 8, marginBottom: 8, gap: 6 }}>
                      <Skeleton width={120} height={38} borderRadius={8} />
                      <Skeleton width="90%" height={14} borderRadius={4} style={{ marginTop: 8 }} />
                    </View>
                  ) : (
                    <>
                      <View style={styles.streakValueRow}>
                        <Animated.View
                          style={[styles.streakDot, { backgroundColor: colors.primary, transform: [{ scale: pulseAnim }] }]}
                        />
                        <Text style={[styles.streakNum, { color: colors.foreground }]}>{streak}</Text>
                        <Text style={[styles.streakUnit, { color: colors.mutedForeground }]}>days</Text>
                      </View>
                      <Text style={[styles.streakHint, { color: colors.mutedForeground }]}>
                        Track your daily mining streak and consistency.
                      </Text>
                    </>
                  )}
                </View>
                {loading ? (
                  <Skeleton width={72} height={72} borderRadius={36} />
                ) : (
                  <View style={[styles.streakCircle, { borderColor: colors.border }]}>
                    <LinearGradient colors={[colors.primaryPale, colors.card]} style={styles.streakCircleInner}>
                      <Feather name="award" size={28} color={colors.primary} />
                    </LinearGradient>
                  </View>
                )}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryPale }]}>
                    <Feather name="repeat" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Swap Chart</Text>
                </View>
                {loading ? (
                  <Skeleton width={55} height={22} borderRadius={9999} />
                ) : (
                  swapChange !== "" && (
                    <View style={[styles.changePill, { backgroundColor: colors.primaryPale }]}>
                      <Feather name="trending-up" size={12} color={colors.primary} />
                      <Text style={[styles.changeText, { color: colors.primary }]}>{swapChange}</Text>
                    </View>
                  )
                )}
              </View>
              <View style={styles.chartSummaryRow}>
                {loading ? (
                  <View style={{ gap: 6 }}>
                    <Skeleton width={80} height={28} borderRadius={6} />
                    <Skeleton width={160} height={14} borderRadius={4} />
                  </View>
                ) : (
                  <>
                    <Text style={[styles.chartBigVal, { color: colors.foreground }]}>
                      {swapWeekTotal > 0 ? swapWeekTotal.toFixed(2) : "0"}
                    </Text>
                    <Text style={[styles.chartBigSub, { color: colors.mutedForeground }]}>Total swap volume this week</Text>
                  </>
                )}
              </View>
              <View style={styles.chartWrap}>
                {loading ? (
                  <View style={{ flexDirection: "row", gap: 12, height: 168, alignItems: "flex-end", justifyContent: "center" }}>
                    {[70, 110, 45, 130, 85, 100, 60].map((h, i) => (
                      <Skeleton key={i} width={28} height={h} borderRadius={6} />
                    ))}
                  </View>
                ) : (
                  <BarChart data={swapChartData} colors={colors} />
                )}
              </View>
            </View>

            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleRow}>
                  <View style={[styles.cardIconWrap, { backgroundColor: colors.primaryPale }]}>
                    <Feather name="activity" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.cardTitle, { color: colors.foreground }]}>Transfer Activity</Text>
                </View>
                {loading ? (
                  <Skeleton width={55} height={22} borderRadius={9999} />
                ) : (
                  transferChange !== "" && (
                    <View style={[styles.changePill, { backgroundColor: colors.primaryPale }]}>
                      <Feather name="trending-up" size={12} color={colors.primary} />
                      <Text style={[styles.changeText, { color: colors.primary }]}>{transferChange}</Text>
                    </View>
                  )
                )}
              </View>
              <View style={styles.chartSummaryRow}>
                {loading ? (
                  <View style={{ gap: 6 }}>
                    <Skeleton width={100} height={28} borderRadius={6} />
                    <Skeleton width={140} height={14} borderRadius={4} />
                  </View>
                ) : (
                  <>
                    <Text style={[styles.chartBigVal, { color: colors.foreground }]}>
                      {transferWeekTotal > 0 ? transferWeekTotal.toFixed(4) : "0"}
                    </Text>
                    <Text style={[styles.chartBigSub, { color: colors.mutedForeground }]}>Total transfers this week</Text>
                  </>
                )}
              </View>
              <View style={styles.chartWrap}>
                {loading ? (
                  <View style={{ width: 280, height: 158, justifyContent: "center", alignItems: "center" }}>
                    <Skeleton width="100%" height={130} borderRadius={12} />
                  </View>
                ) : (
                  <AreaChart data={transferChartData} colors={colors} />
                )}
              </View>
            </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },

  titleRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 24 },
  backBtn:  { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pageTitle:{ fontSize: 26, fontFamily: "Inter_700Bold" },
  pageSub:  { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },

  statsGrid: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statBox:   { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1, alignItems: "center", gap: 6 },
  statIcon:  { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },

  card:       { borderRadius: 20, borderWidth: 1, padding: 20, marginBottom: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIconWrap: { width: 32, height: 32, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle:  { fontSize: 16, fontFamily: "Inter_700Bold" },
  monthPill:  { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 9999 },
  monthText:  { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  calRow:      { flexDirection: "row" },
  calCell:     { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 5 },
  calDayHeader:{ fontSize: 12, fontFamily: "Inter_600SemiBold" },
  calDay:      { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  calDayText:  { fontSize: 13, fontFamily: "Inter_500Medium" },

  streakRow:       { flexDirection: "row", alignItems: "center" },
  streakLabel:     { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  streakValueRow:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  streakDot:       { width: 10, height: 10, borderRadius: 5 },
  streakNum:       { fontSize: 40, fontFamily: "Inter_700Bold", lineHeight: 46 },
  streakUnit:      { fontSize: 16, fontFamily: "Inter_500Medium", marginTop: 8 },
  streakHint:      { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
  streakCircle:    { width: 72, height: 72, borderRadius: 36, borderWidth: 1, overflow: "hidden" },
  streakCircleInner: { flex: 1, alignItems: "center", justifyContent: "center" },

  changePill:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  changeText:     { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  chartSummaryRow:{ marginBottom: 16 },
  chartBigVal:    { fontSize: 28, fontFamily: "Inter_700Bold" },
  chartBigSub:    { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  chartWrap:      { alignItems: "center", overflow: "hidden" },
});
