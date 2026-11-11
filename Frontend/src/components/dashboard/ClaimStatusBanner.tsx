
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift, Clock, RefreshCcw, AlertCircle, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

export default function ClaimStatusBanner() {
    const [statusData, setStatusData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [dismissedClaims, setDismissedClaims] = useState<string[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('dismissed_claims');
        if (saved) {
            try {
                setDismissedClaims(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse dismissed claims", e);
            }
        }
    }, []);

    const handleDismiss = () => {
        if (statusData?.id) {
            const newDismissed = [...dismissedClaims, statusData.id];
            setDismissedClaims(newDismissed);
            localStorage.setItem('dismissed_claims', JSON.stringify(newDismissed));
        }
        setStatusData(null);
    };

    const fetchStatus = useCallback(async () => {
        try {
            const res = await api.get('/wallet/claim-status');
            setStatusData(res.data);
        } catch (error) {
            setStatusData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [fetchStatus]);

    if (loading || !statusData) return null;

    // Show banner only if PENDING or PROCESSING (Auto-remove if SENT)
    const showBanner = statusData.status === 'pending' || statusData.status === 'processing';
    const isFailed = statusData.status === 'failed';

    const isDismissed = statusData.id && dismissedClaims.includes(statusData.id);

    if (isDismissed) return null;

    if (!showBanner && !isFailed) return null;

    const isPending = statusData.status === 'pending';
    const isProcessing = statusData.status === 'processing';
    const isSent = statusData.status === 'sent';

    return (
        <AnimatePresence>
            <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="w-full bg-secondary/30 border-b border-border overflow-hidden"
            >
                <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-full",
                            isFailed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                        )}>
                            {isPending && <Clock className="w-4 h-4 animate-pulse" />}
                            {isProcessing && <RefreshCcw className="w-4 h-4 animate-spin" />}
                            {isFailed && <AlertCircle className="w-4 h-4" />}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-foreground">
                                {isPending && "Your claim request is pending. Arrival time: ~24 hours."}
                                {isProcessing && "Your claim is being processed on the blockchain..."}
                                {isFailed && `Claim Failed: ${statusData.error || "Unknown error"}`}
                            </p>
                            {statusData.txHash && (
                                <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                                    Tx: {statusData.txHash}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchStatus}
                            className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                            title="Refresh Status"
                        >
                            <RefreshCcw className="w-4 h-4" />
                        </button>
                        {isFailed && (
                            <button
                                onClick={handleDismiss}
                                className="text-xs font-semibold px-3 py-1 bg-destructive text-destructive-foreground rounded-md hover:opacity-90"
                            >
                                Dismiss
                            </button>
                        )}
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
