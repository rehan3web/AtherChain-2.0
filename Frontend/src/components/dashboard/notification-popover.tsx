"use client"

import * as React from "react"
import { Bell } from "lucide-react"
import { useNotifications } from "@/hooks/useNotifications"
import { NotificationList } from "./notification-list"
import { NotificationPermissionDialog } from "./notification-permission-dialog"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function NotificationPopover() {
    const { notifications, unreadCount, markAsRead } = useNotifications()
    const [open, setOpen] = React.useState(false)
    const [showPermissionDialog, setShowPermissionDialog] = React.useState(false)

    const handleOpenPopover = () => {
        if (!("Notification" in window)) {
            setOpen(true)
            return
        }

        if (Notification.permission === "granted") {
            setOpen(true)
        } else {
            setShowPermissionDialog(true)
        }
    }

    return (
        <>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                            e.preventDefault()
                            handleOpenPopover()
                        }}
                        className="relative size-8 rounded-none hover:bg-accent border border-transparent hover:border-border transition-all duration-200"
                    >
                        <Bell className="size-4" />
                        {unreadCount > 0 && (
                            <span className="absolute top-1.5 right-1.5 flex h-2 w-2 rounded-full bg-primary border border-background shadow-sm" />
                        )}
                        <span className="sr-only">Notifications</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 rounded-none border border-border bg-background shadow-2xl" align="end" sideOffset={8}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                        <h4 className="text-sm font-semibold tracking-tight uppercase opacity-50">Notifications</h4>
                        {unreadCount > 0 && (
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm uppercase tracking-tighter">
                                {unreadCount} New
                            </span>
                        )}
                    </div>
                    <div className="max-h-[400px] overflow-y-auto p-2 custom-scrollbar">
                        <NotificationList
                            notifications={notifications}
                            markAsRead={markAsRead}
                        />
                    </div>
                    <div className="p-2 border-t border-border bg-muted/10">
                        <Button variant="ghost" size="sm" className="w-full text-[11px] font-medium uppercase tracking-wider h-8 rounded-none opacity-50 hover:opacity-100">
                            View All Activity
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>

            <NotificationPermissionDialog
                open={showPermissionDialog}
                onOpenChange={setShowPermissionDialog}
                onGranted={() => setOpen(true)}
            />
        </>
    )
}
