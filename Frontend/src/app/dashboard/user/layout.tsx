
"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import {
    LayoutDashboard,
    Pickaxe,
    Wallet,
    ArrowRightLeft,
    Users,
    FileCheck,
    History,
} from "lucide-react"

const userNavData = {
    user: {
        name: "User",
        email: "user@example.com",
        avatar: "/avatars/user.jpg",
    },
    navMain: [
        {
            title: "Dashboard",
            url: "/dashboard/user",
            icon: LayoutDashboard,
            isActive: true,
        },
        {
            title: "Mining",
            url: "/dashboard/mining",
            icon: Pickaxe,
        },
        {
            title: "Wallet",
            url: "/dashboard/wallet",
            icon: Wallet,
        },
        {
            title: "Swap",
            url: "/dashboard/swap",
            icon: ArrowRightLeft,
        },
        {
            title: "Referral",
            url: "/dashboard/referral",
            icon: Users,
        },
        {
            title: "KYC",
            url: "/dashboard/kyc",
            icon: FileCheck,
        },
        {
            title: "Transactions",
            url: "/dashboard/transactions",
            icon: History,
        }
    ],
}

import { useAuth } from "@/providers/AuthProvider"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { Loader } from "@/components/ui/Loader"

export default function UserDashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading && !user) {
            router.push("/login")
        }
    }, [loading, user, router])

    if (loading) return <Loader fullScreen />
    if (!user) return null

    return <DashboardLayout sidebarData={{
        ...userNavData,
        user: {
            name: (user as any).name || "User",
            email: (user as any).email || "user@example.com",
            avatar: (user as any).avatar || "/avatars/user.jpg",
        }
    }}>{children}</DashboardLayout>
}
