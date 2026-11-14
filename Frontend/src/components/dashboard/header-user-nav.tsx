"use client"

import * as React from "react"
import { useAuth } from "@/providers/AuthProvider"
import {
    LogOut,
    User,
    Settings,
    CreditCard,
    ShieldCheck,
} from "lucide-react"
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
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import api from "@/lib/api"
import Image from "next/image"
import { cn } from "@/lib/utils"

export function HeaderUserNav() {
    const { user, logout } = useAuth()

    if (!user) return null

    const getFullImageUrl = (path?: string) => {
        if (!path) return "/avatars/user.jpg"
        if (path.startsWith('http')) return path
        return `${api.defaults.baseURL}${path}`
    }

    const avatarUrl = getFullImageUrl(user.profile_image)

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    className="relative size-8 rounded-none p-0 border border-transparent hover:border-border transition-all duration-200"
                >
                    <Avatar className="h-8 w-8 rounded-none grayscale hover:grayscale-0 transition-all duration-300">
                        <AvatarImage src={avatarUrl} alt={user.username} className="rounded-none object-cover" />
                        <AvatarFallback className="rounded-none">
                            {user.username?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-none border border-border bg-background shadow-2xl" align="end" sideOffset={8}>
                <DropdownMenuLabel className="font-normal p-0">
                    <div className="flex items-center gap-3 px-3 py-3 border-b border-border bg-muted/30">
                        <Avatar className="h-9 w-9 rounded-none border border-border">
                            <AvatarImage src={avatarUrl} alt={user.username} className="rounded-none object-cover" />
                            <AvatarFallback className="rounded-none">
                                {user.username?.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col space-y-0.5">
                            <p className="text-sm font-bold leading-none tracking-tight">{user.username}</p>
                            <p className="text-[10px] leading-none text-muted-foreground uppercase tracking-widest opacity-60">
                                {user.email}
                            </p>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="m-0" />
                <DropdownMenuGroup className="p-1">
                    <DropdownMenuItem asChild className="rounded-none cursor-pointer">
                        <a href="/dashboard/account" className="flex items-center w-full">
                            <User className="mr-2 h-4 w-4 opacity-50" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Account</span>
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-none cursor-pointer">
                        <a href="/dashboard/wallet" className="flex items-center w-full">
                            <CreditCard className="mr-2 h-4 w-4 opacity-50" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Wallet</span>
                        </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-none cursor-pointer">
                        <a href="/dashboard/account" className="flex items-center w-full">
                            <Settings className="mr-2 h-4 w-4 opacity-50" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Settings</span>
                        </a>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="m-0" />
                <div className="p-1">
                    <DropdownMenuItem
                        onClick={logout}
                        className="rounded-none cursor-pointer text-red-500 focus:text-red-500 focus:bg-red-500/10"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">Log out</span>
                    </DropdownMenuItem>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
