"use client"

import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

interface LoaderProps {
    className?: string
    size?: "sm" | "md" | "lg" | "xl"
    fullScreen?: boolean
}

export function Loader({ className, size = "md", fullScreen = false }: LoaderProps) {
    const sizeClasses = {
        sm: "w-6 h-6",
        md: "w-10 h-10",
        lg: "w-16 h-16",
        xl: "w-24 h-24",
    }

    const loaderContent = (
        <div className={cn("relative flex items-center justify-center", sizeClasses[size], className)}>
            {/* Outer spinning ring - Technical segments */}
            <motion.svg
                viewBox="0 0 100 100"
                className="absolute inset-0 w-full h-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
                <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray="15 10"
                    className="text-primary opacity-20"
                />
                <path
                    d="M 50 5 A 45 45 0 0 1 95 50"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="square"
                    className="text-primary"
                />
            </motion.svg>

            {/* Inner pulsing hex or diamond */}
            <motion.div
                className="w-1/3 h-1/3 bg-primary rotate-45"
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />

            {/* Scanning line effect */}
            <motion.div
                className="absolute top-0 left-0 w-full h-[1px] bg-primary/40 shadow-[0_0_8px_rgba(var(--primary),0.5)]"
                animate={{
                    top: ["0%", "100%", "0%"],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "linear",
                }}
            />
        </div>
    )

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                {loaderContent}
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="mt-4 text-xs font-mono uppercase tracking-[0.3em] text-primary"
                >
                    Synchronizing Ather Network
                </motion.p>
            </div>
        )
    }

    return loaderContent
}
