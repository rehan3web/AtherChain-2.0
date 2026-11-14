'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function AppDownloadBanner() {
    const [isVisible, setIsVisible] = useState(true);

    const handleDismiss = () => {
        setIsVisible(false);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className={cn(
                        "relative flex items-center justify-between p-4 mb-4 border-b md:border md:rounded-lg",
                        "bg-primary/10 border-primary/20"
                    )}>
                        <div className="flex items-center gap-3 pr-8">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Smartphone className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-foreground">Download Android App</h3>
                                <p className="text-xs text-muted-foreground mt-1">
                                    All new mining features will be announced and released only on the Android app. Upcoming features will not be announced on the website.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <Link href="https://atherchain.sfo3.cdn.digitaloceanspaces.com/atherchain.apk" className="hidden md:inline-flex px-4 py-2 text-xs font-semibold text-primary-foreground bg-primary rounded-md hover:bg-primary/90 transition-colors">
                                Download App
                            </Link>
                            <button
                                onClick={handleDismiss}
                                className="absolute top-4 right-4 md:relative md:top-0 md:right-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
