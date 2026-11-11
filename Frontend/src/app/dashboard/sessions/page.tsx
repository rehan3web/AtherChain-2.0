"use client"

import { SecuritySection } from "../account/components/SecuritySection"
import { motion } from "framer-motion"

export default function SessionsPage() {
    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 lg:p-12 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <header className="space-y-4 border-b border-border pb-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2"
                    >
                        <div className="w-2 h-2 bg-primary rounded-sm" />
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground uppercase">
                            Active Sessions
                        </h1>
                    </motion.div>
                    <p className="text-muted-foreground uppercase text-xs tracking-widest">
                        Manage devices where your account is currently logged in.
                    </p>
                </header>

                <div className="mt-8">
                    <SecuritySection />
                </div>
            </div>
        </div>
    )
}
