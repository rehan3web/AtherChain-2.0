import { cn } from "@/lib/utils";
import {
    Info,
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    ShieldAlert,
    X
} from "lucide-react";

export type AlertType = "default" | "primary" | "secondary" | "success" | "warning" | "danger" | "error" | "info";

export interface CustomAlertProps {
    type: AlertType;
    children: React.ReactNode;
    className?: string;
    onClose?: () => void;
}

const variants = {
    default: {
        bg: "bg-muted/50",
        border: "border-border",
        text: "text-foreground",
        iconColor: "text-muted-foreground",
        iconBg: "bg-muted",
        Icon: Info,
        glow: "alert-glow-default"
    },
    primary: {
        bg: "bg-blue-500/10 dark:bg-blue-500/20",
        border: "border-blue-500/20 dark:border-blue-500/30",
        text: "text-blue-700 dark:text-blue-300",
        iconColor: "text-blue-600 dark:text-blue-400",
        iconBg: "bg-blue-500/20 dark:bg-blue-500/30",
        Icon: Info,
        glow: "alert-glow-primary"
    },
    secondary: {
        bg: "bg-purple-500/10 dark:bg-purple-500/20",
        border: "border-purple-500/20 dark:border-purple-500/30",
        text: "text-purple-700 dark:text-purple-300",
        iconColor: "text-purple-600 dark:text-purple-400",
        iconBg: "bg-purple-500/20 dark:bg-purple-500/30",
        Icon: Info,
        glow: "alert-glow-secondary"
    },
    success: {
        bg: "bg-green-500/10 dark:bg-green-500/20",
        border: "border-green-500/20 dark:border-green-500/30",
        text: "text-green-700 dark:text-green-300",
        iconColor: "text-green-600 dark:text-green-400",
        iconBg: "bg-green-500/20 dark:bg-green-500/30",
        Icon: CheckCircle2,
        glow: "alert-glow-success"
    },
    warning: {
        bg: "bg-orange-500/10 dark:bg-orange-500/20",
        border: "border-orange-500/20 dark:border-orange-500/30",
        text: "text-orange-700 dark:text-orange-300",
        iconColor: "text-orange-600 dark:text-orange-400",
        iconBg: "bg-orange-500/20 dark:bg-orange-500/30",
        Icon: ShieldAlert,
        glow: "alert-glow-warning"
    },
    danger: {
        bg: "bg-red-500/10 dark:bg-red-500/20",
        border: "border-red-500/20 dark:border-red-500/30",
        text: "text-red-700 dark:text-red-300",
        iconColor: "text-red-600 dark:text-red-400",
        iconBg: "bg-red-500/20 dark:bg-red-500/30",
        Icon: AlertCircle,
        glow: "alert-glow-danger"
    },
    error: {
        bg: "bg-red-600/15 dark:bg-red-600/25",
        border: "border-red-600/30 dark:border-red-600/40",
        text: "text-red-700 dark:text-red-200",
        iconColor: "text-red-600 dark:text-red-400",
        iconBg: "bg-red-600/20 dark:bg-red-600/35",
        Icon: AlertCircle,
        glow: "alert-glow-error"
    },
    info: {
        bg: "bg-sky-500/10 dark:bg-sky-500/20",
        border: "border-sky-500/20 dark:border-sky-500/30",
        text: "text-sky-700 dark:text-sky-300",
        iconColor: "text-sky-600 dark:text-sky-400",
        iconBg: "bg-sky-500/20 dark:bg-sky-500/30",
        Icon: Info,
        glow: "alert-glow-primary"
    }
};

export function CustomAlert({ type, children, className, onClose }: CustomAlertProps) {
    const style = variants[type] || variants.default;
    const Icon = style.Icon;

    return (
        <div className={cn(
            "relative w-full overflow-hidden rounded-xl border p-4 backdrop-blur-sm transition-all duration-300 hover:scale-[1.01]",
            style.bg,
            style.border,
            style.glow,
            className
        )}>
            <div className="flex items-center gap-4">
                {/* Icon Circle */}
                <div className={cn(
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-inner",
                    style.iconBg
                )}>
                    <Icon className={cn("h-6 w-6", style.iconColor)} strokeWidth={2.5} />
                </div>

                {/* Content */}
                <div className={cn("flex-1 text-base font-medium", style.text)}>
                    {children}
                </div>

                {/* Close Button */}
                {onClose && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className={cn(
                            "shrink-0 rounded-full p-1 opacity-70 transition-opacity hover:bg-black/10 hover:opacity-100 focus:outline-none dark:hover:bg-white/10",
                            style.text
                        )}
                    >
                        <X className="h-5 w-5" />
                        <span className="sr-only">Close</span>
                    </button>
                )}
            </div>

            {/* Decorative colored line at bottom */}
            <div className={cn(
                "absolute bottom-0 left-0 h-[2px] w-full opacity-20",
                style.iconColor.replace('text-', 'bg-')
            )} />
        </div>
    );
}
