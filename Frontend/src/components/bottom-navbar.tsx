"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    LayoutDashboard,
    Pickaxe,
    ArrowRightLeft,
    Wallet,
    Users,
    TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
    {
        title: "Home",
        url: "/dashboard",
        icon: LayoutDashboard,
    },
    {
        title: "Node",
        url: "/dashboard/mining",
        icon: Pickaxe,
    },
    {
        title: "Swap",
        url: "/dashboard/swap",
        icon: ArrowRightLeft,
    },
    {
        title: "Wallet",
        url: "/dashboard/wallet",
        icon: Wallet,
    },

    {
        title: "Referral",
        url: "/dashboard/referral",
        icon: Users,
    },
]

export function BottomNavbar() {
    const pathname = usePathname()

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
            {/* Glass effect container */}
            <div className="relative bg-background/60 backdrop-blur-xl border-t border-border/50 shadow-[0_-4px_24px_-8px_rgba(0,0,0,0.1)] rounded-t-[24px] px-2 pb-safe-area-inset-bottom">
                <div className="flex items-center justify-around h-20">
                    {navItems.map((item) => {
                        const isActive = pathname === item.url
                        return (
                            <Link
                                key={item.title}
                                href={item.url}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1.5 min-w-[64px] transition-all duration-300",
                                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                )}
                                prefetch={true}
                            >
                                <div className={cn(
                                    "p-2 rounded-xl transition-all duration-300",
                                    isActive && "bg-primary/10 scale-110 shadow-sm"
                                )}>
                                    <item.icon className={cn("size-6 transition-all", isActive && "stroke-[2.5px]")} />
                                </div>
                                <span className={cn(
                                    "text-[10px] font-semibold tracking-wide uppercase transition-all duration-300",
                                    isActive ? "opacity-100" : "opacity-60"
                                )}>
                                    {item.title}
                                </span>
                                {isActive && (
                                    <div className="absolute top-0 w-8 h-1 bg-primary rounded-full" />
                                )}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
