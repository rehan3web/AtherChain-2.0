"use client"

import * as React from "react"
import { formatDistanceToNow } from "date-fns"
import { Notification } from "@/hooks/useNotifications"

interface NotificationListProps {
    notifications: Notification[]
    markAsRead: (id: number) => void
}

export function NotificationList({ notifications, markAsRead }: NotificationListProps) {
    if (notifications.length === 0) {
        return (
            <div className="py-8 text-center text-muted-foreground text-sm">
                No notifications
            </div>
        )
    }

    return (
        <div className="grid gap-2">
            {notifications.map((notification) => (
                <div
                    key={notification.id}
                    className={`flex flex-col gap-1 p-3 rounded-lg border text-sm transition-colors ${notification.read
                        ? "bg-background border-border"
                        : "bg-muted/50 border-primary/20"
                        }`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                    role="button"
                >
                    <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold">{notification.title}</span>
                        {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        )}
                    </div>
                    <p className="text-muted-foreground line-clamp-2">{notification.message}</p>
                    <span className="text-[10px] text-muted-foreground/80 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    </span>
                </div>
            ))}
        </div>
    )
}
