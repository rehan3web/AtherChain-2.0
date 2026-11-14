'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from '@/components/site-header';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import {
    LayoutDashboard,
    Users,
    ShieldCheck,
    LifeBuoy,
    Newspaper,
    Bell,
    Settings,
    ShieldAlert,
    Smartphone,
} from 'lucide-react';

const adminNavData = {
    user: {
        name: "Administrator",
        email: "admin@athernet.io",
        avatar: "/avatars/admin.jpg",
    },
    navMain: [
        {
            title: "Overview",
            url: "/admin/dashboard",
            icon: LayoutDashboard,
        },
        {
            title: "Users",
            url: "/admin/users",
            icon: Users,
        },
        {
            title: "KYC",
            url: "/admin/kyc",
            icon: ShieldCheck,
        },
        {
            title: "Support",
            url: "/admin/support",
            icon: LifeBuoy,
        },
        {
            title: "News & Updates",
            url: "/admin/news",
            icon: Newspaper,
        },
        {
            title: "Notifications",
            url: "/admin/notifications",
            icon: Bell,
        },
        {
            title: "Settings",
            url: "/admin/settings",
            icon: Settings,
        },
        {
            title: "KYC Rules",
            url: "/admin/kyc-rules",
            icon: ShieldAlert,
        },
        {
            title: "App Management",
            url: "/admin/app-management",
            icon: Smartphone,
        },
    ],
    navSecondary: [],
    navDocuments: [],
};

export default function AdminDashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        const token = localStorage.getItem('admin_token');
        if (!token) {
            router.replace('/admin/login');
        }
    }, [router, pathname]);

    const handleAdminLogout = () => {
        localStorage.removeItem('admin_token');
        router.push('/admin/login');
    };

    return (
        <SidebarProvider
            style={{
                "--sidebar-width": "calc(var(--spacing) * 72)",
                "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties}
        >
            <AppSidebar
                variant="inset"
                data={adminNavData}
                onLogout={handleAdminLogout}
                logoHref="/admin/dashboard"
            />
            <SidebarInset className="min-w-0 overflow-x-hidden">
                <SiteHeader />
                <main className="flex flex-1 flex-col p-4 md:p-8">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
