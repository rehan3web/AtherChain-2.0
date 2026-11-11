"use client"

import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/providers/AuthProvider"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, Suspense } from "react"
import {
    LayoutDashboard,
    Wallet,
    History,
    Settings,
    ShieldAlert,
    HelpCircle,
    FileText,
    ShieldCheck,
    Lock,
    TrendingUp,
    CandlestickChart,
    Smartphone
} from "lucide-react"


const userNavData = {
    user: {
        name: "User",
        email: "user@example.com",
        avatar: "/avatars/user.jpg",
    },
    navMain: [
        {
            title: "Home",
            url: "/dashboard",
            icon: LayoutDashboard,
        },
        {
            title: "Wallet",
            url: "/dashboard/wallet",
            icon: Wallet,
        },
        {
            title: "Market",
            url: "/dashboard/market",
            icon: CandlestickChart,
        },
        {
            title: "Sessions",
            url: "/dashboard/sessions",
            icon: ShieldAlert,
        },
        {
            title: "Settings",
            url: "/dashboard/account",
            icon: Settings,
        },
    ],
    navSecondary: [
        {
            title: "Download Android App",
            url: "https://atherchain.sfo3.cdn.digitaloceanspaces.com/atherchain.apk",
            icon: Smartphone,
        },
        {
            title: "Help",
            url: "/dashboard/support",
            icon: HelpCircle,
        },
    ],
    navDocuments: [
        {
            title: "Terms of Service",
            url: "/terms",
            icon: FileText,
        },
        {
            title: "Privacy Policy",
            url: "/privacy",
            icon: ShieldCheck,
        },
    ]
}



import { Loader } from "@/components/ui/Loader"
import AppDownloadBanner from "@/components/dashboard/AppDownloadBanner"
import SwapStatusBanner from "@/components/dashboard/SwapStatusBanner"
import ClaimStatusBanner from "@/components/dashboard/ClaimStatusBanner"
import { BottomNavbar } from "@/components/bottom-navbar"

export default function DashboardLayoutWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, loading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [loading, user, router]);

    if (loading) return <Loader fullScreen />;
    if (!user) return null;

    // If path is admin, do not render user layout wrapping (avoid nesting)
    if (pathname?.startsWith('/dashboard/admin')) {
        return <>{children}</>
    }

    return (
        <DashboardLayout sidebarData={userNavData}>
            <AppDownloadBanner />
            <SwapStatusBanner />
            <ClaimStatusBanner />
            <div className="flex-1 overflow-auto pb-20 md:pb-0">
                <Suspense fallback={<Loader fullScreen />}>
                    {children}
                </Suspense>
            </div>
            <BottomNavbar />
        </DashboardLayout>
    );
}

