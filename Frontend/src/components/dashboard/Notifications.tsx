import { useState, useEffect } from "react"
import { Bell, Check, MailOpen } from "lucide-react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface Notification {
    id: string
    title: string
    message: string
    created_at: string
    read: boolean
}

export function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [isOpen, setIsOpen] = useState(false)

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications')
            setNotifications(res.data)
            setUnreadCount(res.data.filter((n: Notification) => !n.read).length)
        } catch (error) {
            console.error("Failed to fetch notifications", error)
        }
    }

    useEffect(() => {
        fetchNotifications()
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [])

    const handleMarkAsRead = async (id: string) => {
        try {
            await api.post(`/notifications/${id}/read`)
            setNotifications(prev => prev.map(n =>
                n.id === id ? { ...n, read: true } : n
            ))
            setUnreadCount(prev => Math.max(0, prev - 1))
        } catch (error) {
            console.error("Failed to mark read", error)
        }
    }

    return (
        <DropdownMenu open={isOpen} onOpenChange={(open) => {
            setIsOpen(open)
            if (open) fetchNotifications()
        }}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    <span className="sr-only">Notifications</span>
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full p-0 text-[10px]"
                        >
                            {unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && <span className="text-xs text-muted-foreground">{unreadCount} unread</span>}
                </div>
                <div className="h-[300px] overflow-y-auto">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
                            <MailOpen className="h-8 w-8 opacity-20" />
                            <p className="text-sm">No notifications</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={cn(
                                        "p-4 hover:bg-muted/50 transition-colors flex gap-3 text-left cursor-pointer",
                                        !notification.read && "bg-muted/10"
                                    )}
                                    onClick={() => !notification.read && handleMarkAsRead(notification.id)}
                                >
                                    <div className={cn(
                                        "mt-1 h-2 w-2 rounded-full shrink-0",
                                        !notification.read ? "bg-blue-500" : "bg-transparent"
                                    )} />
                                    <div className="flex-1 space-y-1">
                                        <p className={cn("text-sm font-medium leading-none", !notification.read && "text-foreground")}>
                                            {notification.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {notification.message}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground pt-1">
                                            {new Date(notification.created_at).toLocaleDateString()} {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
