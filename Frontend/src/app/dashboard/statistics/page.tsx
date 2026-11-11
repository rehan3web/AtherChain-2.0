"use client"

import { useState, useEffect } from "react"
import { MiningCalendar } from "@/components/dashboard/stats/MiningCalendar"
import { StatsChart } from "@/components/dashboard/stats/StatsChart"
import { MiningRateChart } from "@/components/dashboard/stats/MiningRateChart"
import api from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"
import { SectionCards } from "@/components/section-cards"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import useSWR from "swr"

const fetcher = (url: string) => api.get(url).then((res) => res.data)


interface UserStats {
    miningCalendar: { date: string; status: string }[];
    swapActivity: { date: string; volume: number }[];
    transferActivity: { date: string; volume: number }[];
}

export default function StatisticsPage() {
    const [stats, setStats] = useState<UserStats | null>(null);
    const [isFetchingLocal, setIsFetchingLocal] = useState(true);
    const { data: dashStats, isValidating: dashValidating } = useSWR('/user/dashboard/stats', fetcher)


    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await api.get('/user/statistics'); // Corrected prefix
                setStats(res.data);
            } catch (error) {
                console.error("Failed to load stats", error);
            } finally {
                setIsFetchingLocal(false);
            }

        }
        fetchStats();
    }, []);

    const combinedLoading = isFetchingLocal || (!dashStats && dashValidating);



    if (combinedLoading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <Skeleton className="h-[200px] w-full rounded-xl" />
                <Skeleton className="h-[400px] w-full rounded-xl" />
                <Skeleton className="h-[400px] w-full rounded-xl" />
            </div>
        )
    }


    return (
        <div className="flex flex-1 flex-col gap-0.5 p-4 md:p-6 pt-2">
            {/* Section 1: Yield Matrix (Stats Grid) */}


            {/* Section 2: Mining Performance (Chart) */}
            <section className="mb-4 mt-2">
                <div className="px-1 md:px-2">
                    <ChartAreaInteractive data={dashStats?.analytics?.miningHistory} />
                </div>
            </section>

            <div className="grid auto-rows-fr gap-1.5 md:grid-cols-2 lg:grid-cols-2">
                {/* Box 1: Mining Calendar */}
                <div className="rounded-xl overflow-hidden border bg-card text-card-foreground shadow p-2">
                    <MiningCalendar minedDates={stats?.miningCalendar || []} />
                </div>

                {/* Box 2: Swap Stats */}
                <StatsChart
                    title="Swap Activity"
                    description="Daily swap volume statistics"
                    data={stats?.swapActivity || []}
                    lineColor="#3b82f6" // Blue
                    emptyMessage="No swaps recorded yet"
                />

                {/* Box 3: Transfer Stats */}
                <StatsChart
                    title="Transfer Activity"
                    description="Send & Receive transaction volume"
                    data={stats?.transferActivity || []}
                    lineColor="#10b981" // Green
                    emptyMessage="No transfers recorded yet"
                />

                {/* Box 4: Mining Rate */}
                <MiningRateChart />
            </div>
        </div>
    )

}
