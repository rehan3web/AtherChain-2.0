"use client"

import * as React from "react"
import { type LucideIcon } from "lucide-react"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavDocuments({
  items,
  title,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
  }[]
  title?: string
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      {title && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/50 mb-2 px-4">{title}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className={cn(
                    "relative transition-all duration-200 hover:bg-sidebar-accent/50",
                    isActive && "bg-sidebar-accent font-medium text-sidebar-primary"
                  )}
                >
                  <a href={item.url} className="flex items-center gap-3 w-full px-3 py-2">
                    <item.icon className={cn("size-4 transition-colors", isActive ? "text-primary" : "opacity-70 group-hover:opacity-100")} />
                    <span>{item.title}</span>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                    )}
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

