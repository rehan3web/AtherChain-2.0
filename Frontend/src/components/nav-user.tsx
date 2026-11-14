"use client"

import Link from "next/link"
import { useAuth } from "@/providers/AuthProvider"
import { useNotifications } from "@/hooks/useNotifications"
import { formatDistanceToNow } from "date-fns"
import { NotificationList } from "./dashboard/notification-list"
import {
  CreditCard,
  MoreHorizontal,
  LogOut,
  Bell,
  User,
  Sun,
  Moon,
  Check,
} from "lucide-react"

import { useTheme } from "next-themes"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import api from "@/lib/api"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

import Image from "next/image"

export function NavUser({
  user,
  onLogout,
}: {
  user: {
    name: string
    email: string
    avatar: string
    kyc_status?: string
  },
  onLogout?: () => void
}) {
  const { isMobile } = useSidebar()
  const { logout: defaultLogout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { notifications, unreadCount, markAsRead } = useNotifications()

  const handleLogout = onLogout || defaultLogout;

  // Ensure the avatar URL is correctly formatted if it's a relative path from the server
  const avatarUrl = user.avatar.startsWith('http') || user.avatar.startsWith('/')
    ? user.avatar
    : `${api.defaults.baseURL}${user.avatar}`;

  const kycConfig = (status?: string) => {
    switch (status) {
      case 'approved':
        return { text: 'Verified', color: 'text-green-500', bg: 'bg-green-500/10' };
      case 'rejected':
        return { text: 'Rejected', color: 'text-red-500', bg: 'bg-red-500/10' };
      case 'pending':
        return { text: 'Pending', color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      default:
        return { text: 'Unverified', color: 'text-zinc-500', bg: 'bg-zinc-500/10' };
    }
  };

  const currentKyc = kycConfig(user.kyc_status);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Dialog>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-transparent data-[state=open]:text-foreground border-none hover:bg-transparent"
              >
                <div className="relative">
                  <Avatar className="h-9 w-9 rounded-lg border-none">
                    <AvatarImage src={avatarUrl} alt={user.name} className="rounded-lg" />
                    <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                  </Avatar>
                  {user.kyc_status === 'approved' && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-background rounded-full flex items-center justify-center border border-border">
                      <Image src="/tick.png" alt="Verified" width={10} height={10} className="object-contain" />
                    </div>
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight ml-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-medium">{user.name}</span>
                    {user.kyc_status === 'approved' && (
                      <Image src="/tick.png" alt="Verified" width={14} height={14} className="object-contain" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-foreground/60 truncate text-[11px]">
                      {user.email}
                    </span>
                    <span className={cn("text-[10px] w-fit px-1.5 py-0.5 mt-1 rounded-full uppercase font-bold tracking-tighter shrink-0", currentKyc.bg, currentKyc.color)}>
                      {currentKyc.text}
                    </span>
                  </div>
                </div>
                <MoreHorizontal className="ml-auto size-4 opacity-50 transition-opacity group-hover:opacity-100" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-none border border-border shadow-2xl bg-background"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <div className="relative">
                    <Avatar className="h-9 w-9 rounded-lg border-none transition-transform hover:scale-105">
                      <AvatarImage src={avatarUrl} alt={user.name} className="rounded-lg" />
                      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                    </Avatar>
                    {user.kyc_status === 'approved' && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-background rounded-full flex items-center justify-center border border-border">
                        <Image src="/tick.png" alt="Verified" width={10} height={10} className="object-contain" />
                      </div>
                    )}
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{user.name}</span>
                      {user.kyc_status === 'approved' && (
                        <Image src="/tick.png" alt="Verified" width={14} height={14} className="object-contain" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-muted-foreground truncate text-[11px]">
                        {user.email}
                      </span>
                      <span className={cn("text-[10px] w-fit px-1.5 py-0.5 mt-1 rounded-full uppercase font-bold tracking-tighter", currentKyc.bg, currentKyc.color)}>
                        {currentKyc.text}
                      </span>
                    </div>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/account">
                    <User className="mr-2 h-4 w-4" />
                    Account
                  </Link>
                </DropdownMenuItem>
                <DialogTrigger asChild>
                  <DropdownMenuItem>
                    <div className="flex items-center w-full">
                      <Bell className="mr-2 h-4 w-4" />
                      <span>Notifications</span>
                      {unreadCount > 0 && (
                        <span className="ml-auto flex h-2 w-2 rounded-full bg-red-600" />
                      )}
                    </div>
                  </DropdownMenuItem>
                </DialogTrigger>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <div className="flex items-center justify-between px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors cursor-default">
                  <div className="flex items-center text-sm font-medium">
                    {theme === "dark" ? (
                      <Moon className="mr-2 h-4 w-4" />
                    ) : (
                      <Sun className="mr-2 h-4 w-4" />
                    )}
                    Light Mode
                  </div>
                  <Switch
                    checked={theme !== "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "light" : "dark")}
                    className="scale-75"
                  />
                </div>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
          <DialogContent className="sm:max-w-[425px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Notifications</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
              <NotificationList
                notifications={notifications}
                markAsRead={markAsRead}
              />
            </div>
          </DialogContent>
        </Dialog>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
