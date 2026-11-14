
"use client"

import * as React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { MarketTicker } from "@/components/dashboard/market-ticker"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"

interface DashboardLayoutProps {
    children: React.ReactNode;
    sidebarData: any; // Type this properly if possible, but 'any' is safe for now given the complexity of the data object
}

export function DashboardLayout({ children, sidebarData }: DashboardLayoutProps) {
    return (
        <SidebarProvider
            style={
                {
                    "--sidebar-width": "calc(var(--spacing) * 72)",
                    "--header-height": "calc(var(--spacing) * 12)",
                } as React.CSSProperties
            }
        >
            <AppSidebar variant="inset" data={sidebarData} />
            <SidebarInset className="min-w-0 overflow-x-hidden">
                <MarketTicker />
                <SiteHeader />
                <div className="flex flex-1 flex-col">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    )
}
