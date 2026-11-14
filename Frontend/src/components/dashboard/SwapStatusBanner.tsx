'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Clock, CheckCircle, AlertCircle, RefreshCcw } from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAlert } from '@/providers/AlertProvider';

export default function SwapStatusBanner() {
    const [statusData, setStatusData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [dismissedSwaps, setDismissedSwaps] = useState<string[]>([]);
    const { showAlert } = useAlert();

    useEffect(() => {
        const saved = localStorage.getItem('dismissed_swaps');
        if (saved) {
            try {
                setDismissedSwaps(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse dismissed swaps", e);
            }
        }
    }, []);

    const handleDismiss = () => {
        if (statusData?.id) {
            const newDismissed = [...dismissedSwaps, statusData.id];
            setDismissedSwaps(newDismissed);
            localStorage.setItem('dismissed_swaps', JSON.stringify(newDismissed));
        }
        setStatusData(null);
    };

    const fetchStatus = async () => {
        try {
            const res = await api.get('/swap/status');
            setStatusData(res.data);
        } catch (error) {
            // If 404, just means no recent swaps
            setStatusData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let mounted = true;

        const poll = async () => {
            if (!mounted) return;
            await fetchStatus();
        };

        poll(); // Initial fetch

        return () => {
            mounted = false;
        };
    }, []);

    // Effect block just for polling interval, depends on statusData?.status
    useEffect(() => {
        if (loading && !statusData) return;

        const isUnfinished = statusData?.status === 'PENDING' || statusData?.status === 'PROCESSING';
        const pollIntervalTime = isUnfinished ? 3000 : 30000;

        const interval = setInterval(fetchStatus, pollIntervalTime);
        return () => clearInterval(interval);
    }, [statusData?.status, loading]);

    if (loading || !statusData) return null;

    // Show banner only if PENDING or PROCESSING
    const showBanner = statusData.status === 'PENDING' || statusData.status === 'PROCESSING';

    const isDismissed = statusData.id && dismissedSwaps.includes(statusData.id);

    if (isDismissed) return null;

    if (!showBanner && statusData.status !== 'FAILED') return null;

    const isPending = statusData.status === 'PENDING';
    const isProcessing = statusData.status === 'PROCESSING';
    const isFailed = statusData.status === 'FAILED';

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
                                {isPending && "Your transaction is pending. Swap completion window: 24–48 hours."}
                                {isProcessing && "Your swap is being processed on the blockchain..."}
                                {isFailed && (
                                    statusData.error?.includes('insufficient funds')
                                        ? "Swap Failed: insufficient funds for intrinsic transaction cost"
                                        : `Swap Failed: ${statusData.error || "Unknown error"}`
                                )}
                            </p>
                            {isFailed && statusData.error?.includes('insufficient funds') && (
                                <button
                                    onClick={() => window.location.href = '/dashboard/wallet?action=claim'}
                                    className="text-xs font-bold text-primary underline mt-1 hover:text-primary/80 transition-colors"
                                >
                                    Claim here
                                </button>
                            )}
                            {statusData.txHash && (
                                <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px] mt-0.5">
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
