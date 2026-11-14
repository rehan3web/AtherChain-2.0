"use client"

import dynamic from "next/dynamic"
import Link from "next/link"
import { useState } from "react"
import useSWR from "swr"
import api from "@/lib/api"
const ChartAreaInteractive = dynamic(() => import("@/components/chart-area-interactive").then(mod => mod.ChartAreaInteractive), {
  loading: () => <div className="h-[220px] w-full animate-pulse bg-muted/20 rounded-xl" />
})
const DataTable = dynamic(() => import("@/components/data-table").then(mod => mod.DataTable), {
  loading: () => <div className="h-40 w-full animate-pulse bg-muted/20 rounded-xl" />
})
import { SectionCards } from "@/components/section-cards"
import ClaimStatusBanner from "@/components/dashboard/ClaimStatusBanner"

const fetcher = (url: string) => api.get(url).then((res) => res.data)

import {
  Pickaxe,
  TrendingUp,
  Wallet,
  ArrowRightLeft,
  Users,
  FileCheck,
  History,
  MessageSquare,
  Newspaper,
  CandlestickChart,
  Blocks
} from "lucide-react"

export default function Page() {
  const { data: stats, error } = useSWR('/user/dashboard/stats', fetcher, {
    refreshInterval: 30000,
    revalidateOnFocus: true
  })


  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isMining, setIsMining] = useState(false)

  const loading = !stats && !error;

  const quickActions = [
    { title: "Node Reward", icon: Pickaxe, url: "/dashboard/mining" },
    { title: "Statistics", icon: TrendingUp, url: "/dashboard/statistics" },
    { title: "Wallet", icon: Wallet, url: "/dashboard/wallet" },
    { title: "Swap", icon: ArrowRightLeft, url: "/dashboard/swap" },
    { title: "Referral", icon: Users, url: "/dashboard/referral" },
    { title: "Verification", icon: FileCheck, url: "/dashboard/kyc" },
    { title: "Transactions", icon: History, url: "/dashboard/transactions" },
    { title: "News & Updates", icon: Newspaper, url: "/dashboard/news" },

  ]

  const Apps = [
    { title: "Market", icon: CandlestickChart, url: "/dashboard/market" },
    { title: "Block Explorer", icon: Blocks, url: "https://atherscan.com" },
  ]

  if (loading) {
    return (
      <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6 lg:py-8 animate-pulse">
        <div className="h-10 w-full bg-muted/20 rounded-lg mx-4 lg:mx-6" /> {/* Banner placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4 lg:px-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-32 bg-muted/10 rounded-xl" />
          ))}
        </div>
        <div className="px-4 lg:px-6 space-y-4">
          <div className="h-6 w-32 bg-muted/20 rounded" />
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="aspect-square bg-muted/10 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-6 py-4 md:py-6 lg:py-8">
      <ClaimStatusBanner />
      {/* Top Stats Cards */}
      <SectionCards stats={stats} />

      {/* Quick Actions Section */}
      <section className="px-4 lg:px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary rounded-full" />
            Quick Actions
          </h2>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-8 gap-2 md:gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.url}
              className="group relative flex flex-col items-center justify-center p-3 md:p-3 rounded-2xl md:rounded-xl border border-border/40 bg-card/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-card/60 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
            >
              <div className="mb-2 md:mb-2 relative">
                {/* Icon Background Glow */}
                <div className="absolute inset-0 scale-75 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative size-10 md:size-11 rounded-xl md:rounded-lg bg-linear-to-br from-muted/80 to-muted/40 flex items-center justify-center group-hover:from-primary group-hover:to-primary/80 transition-all duration-500 shadow-sm group-hover:shadow-lg group-hover:shadow-primary/20">
                  <action.icon className="size-5 md:size-5 text-muted-foreground group-hover:text-primary-foreground transition-colors duration-500" />
                </div>
              </div>

              <span className="text-[10px] md:text-[11px] font-semibold text-foreground/70 group-hover:text-foreground transition-colors duration-500 text-center tracking-tight px-1 line-clamp-1">
                {action.title}
              </span>

              {/* Subtle inner border for premium feel */}
              <div className="absolute inset-1 rounded-2xl md:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none border border-primary/10 ring-1 ring-inset ring-white/5 dark:ring-white/10" />
            </Link>
          ))}
        </div>
      </section>
      <section className="px-4 lg:px-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary rounded-full" />
            Apps
          </h2>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-8 lg:grid-cols-8 gap-2 md:gap-3">
          {Apps.map((action) => (
            <Link
              key={action.title}
              href={action.url}
              className="group relative flex flex-col items-center justify-center p-3 md:p-3 rounded-2xl md:rounded-xl border border-border/40 bg-card/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-card/60 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
            >
              <div className="mb-2 md:mb-2 relative">
                {/* Icon Background Glow */}
                <div className="absolute inset-0 scale-75 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative size-10 md:size-11 rounded-xl md:rounded-lg bg-linear-to-br from-muted/80 to-muted/40 flex items-center justify-center group-hover:from-primary group-hover:to-primary/80 transition-all duration-500 shadow-sm group-hover:shadow-lg group-hover:shadow-primary/20">
                  <action.icon className="size-5 md:size-5 text-muted-foreground group-hover:text-primary-foreground transition-colors duration-500" />
                </div>
              </div>

              <span className="text-[10px] md:text-[11px] font-semibold text-foreground/70 group-hover:text-foreground transition-colors duration-500 text-center tracking-tight px-1 line-clamp-1">
                {action.title}
              </span>

              {/* Subtle inner border for premium feel */}
              <div className="absolute inset-1 rounded-2xl md:rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none border border-primary/10 ring-1 ring-inset ring-white/5 dark:ring-white/10" />
            </Link>
          ))}
        </div>
      </section>

      {/* Other components can be added here as needed while keeping it minimal */}
    </div>

  )
}

