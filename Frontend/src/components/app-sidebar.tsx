"use client"

import * as React from "react"
import Link from "next/link"
import { GalleryVerticalEnd } from "lucide-react"
import { useTheme } from "next-themes"
import Image from "next/image"

import { cn } from "@/lib/utils"
import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { useAuth } from "@/providers/AuthProvider"
import api from "@/lib/api"

const getFullImageUrl = (path?: string) => {
  if (!path) return "/avatars/user.jpg";
  if (path.startsWith('http')) return path;
  return `${api.defaults.baseURL}${path}`;
};

export const sidebarData = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "/avatars/user.jpg",
  },
  navMain: [] as any[],
  navSecondary: [] as any[],
  navDocuments: [] as any[],
}


export function AppSidebar({
  data,
  onLogout,
  logoHref = "/dashboard",
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  data?: typeof sidebarData,
  onLogout?: () => void,
  logoHref?: string
}) {
  // Use passed data or fall back to empty default to prevent crashes, but prefer passed data
  const safeData = data || sidebarData;
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // Avoid hydration mismatch by waiting for mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const displayUser = user ? {
    name: user.username,
    email: user.email,
    avatar: getFullImageUrl(user.profile_image),
    kyc_status: user.kyc_status,
  } : { ...safeData.user, kyc_status: 'unverified' };

  // Use whitemode.png (white logo) for dark theme, blackmode.png (black logo) for light theme
  const logoSrc = resolvedTheme === 'dark' ? '/blackmode.png' : '/whitemode.png';

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="p-6 h-auto flex items-center justify-start overflow-hidden border-none">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="group/logo !p-0 h-auto hover:bg-transparent"
            >
              <Link href={logoHref} className="flex items-center gap-3 w-full">
                {mounted ? (
                  <>
                    <div className="relative w-10 h-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center group-hover/logo:bg-primary/20 transition-colors duration-300">
                      <Image
                        src={logoSrc}
                        alt="Ather Logo"
                        width={28}
                        height={28}
                        className={cn(
                          "object-contain transition-all duration-300 group-hover/logo:scale-110",
                          resolvedTheme === 'light' ? "contrast-150 brightness-90 saturate-150" : ""
                        )}
                        priority
                        unoptimized
                      />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold uppercase tracking-[0.2em] text-foreground/90">Ather</span>
                      <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/40">Network</span>
                    </div>
                  </>
                ) : (
                  <div className="h-10 w-full animate-pulse bg-muted/20 rounded-xl" />
                )}
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="gap-0 py-2">
        <NavMain items={safeData.navMain || []} />
        <div className="px-4 py-2">
          <div className="h-px bg-sidebar-border/50" />
        </div>
        <NavSecondary items={safeData.navSecondary || []} title="Help & Support" />
        <div className="px-4 py-2">
          <div className="h-px bg-sidebar-border/50" />
        </div>
        <NavDocuments items={safeData.navDocuments || []} title="Documentation" />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={displayUser} onLogout={onLogout} />
      </SidebarFooter>
    </Sidebar>
  )
}
