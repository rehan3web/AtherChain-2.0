"use client"

import * as React from "react"
import { Bell, ShieldCheck, XCircle } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface NotificationPermissionDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onGranted: () => void
}

export function NotificationPermissionDialog({
    open,
    onOpenChange,
    onGranted,
}: NotificationPermissionDialogProps) {
    const [permission, setPermission] = React.useState<NotificationPermission | "unsupported">("default")

    React.useEffect(() => {
        if (!("Notification" in window)) {
            setPermission("unsupported")
        } else {
            setPermission(Notification.permission)
        }
    }, [open])

    const requestPermission = async () => {
        if (!("Notification" in window)) return

        const result = await Notification.requestPermission()
        setPermission(result)
        if (result === "granted") {
            onGranted()
            onOpenChange(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px] rounded-none border-border bg-background shadow-2xl">
                <DialogHeader className="space-y-3 pb-4">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                        <Bell className="w-6 h-6 text-primary" />
                    </div>
                    <DialogTitle className="text-center text-xl font-bold uppercase tracking-tight">
                        Enable Notifications
                    </DialogTitle>
                    <DialogDescription className="text-center text-sm opacity-70">
                        Stay updated with real-time alerts on your wallet activity and market movements.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-muted/30 border border-border">
                        <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-bold uppercase tracking-wider">Secure & Private</p>
                            <p className="text-[11px] text-muted-foreground">We only send important system alerts and security updates.</p>
                        </div>
                    </div>

                    {permission === "denied" && (
                        <div className="flex items-start gap-3 p-3 bg-red-500/5 border border-red-500/20">
                            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-bold uppercase tracking-wider text-red-500">Notifications Blocked</p>
                                <p className="text-[11px] text-muted-foreground">Please enable notifications in your browser settings to receive alerts.</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex-col sm:flex-col gap-2 mt-4">
                    <Button
                        onClick={requestPermission}
                        className="w-full rounded-none font-bold uppercase tracking-widest h-11"
                        disabled={permission === "denied" || permission === "unsupported"}
                    >
                        {permission === "denied" ? "Permission Denied" : "Enable Now"}
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        className="w-full rounded-none font-semibold uppercase tracking-widest text-[10px] opacity-50 hover:opacity-100"
                    >
                        Maybe Later
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
