'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    RefreshCcw, ArrowRight, Zap, ShieldCheck,
    Link as LinkIcon, Activity, CheckCircle2, AlertCircle,
    ArrowDown, Wallet, Loader2, Check, Copy, RefreshCw, Clock, ChevronDown
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import api from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useAlert } from '@/providers/AlertProvider';
import { cn } from '@/lib/utils';

const SWAP_STEPS = [
    { id: 'validate', label: 'Validating Swap Pair', icon: ShieldCheck },
    { id: 'reserve', label: 'Allocating Treasury Liquidity', icon: Wallet },
    { id: 'broadcast', label: 'Broadcasting to Mainnet', icon: Activity },
    { id: 'confirm', label: 'Confirming Transaction', icon: LinkIcon }
];

export default function SwapPage() {
    const { user, refreshUser } = useAuth();
    const { showAlert } = useAlert();
    const [rate, setRate] = useState<any>(null);
    const [swapStatus, setSwapStatus] = useState<any>(null);
    const [amountAT, setAmountAT] = useState('');
    const [fromToken] = useState<string>('AT');
    const [toToken] = useState<string>('ATH');
    const [loading, setLoading] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [successData, setSuccess] = useState<any>(null);
    const [cooldownTime, setCooldownTime] = useState<string | null>(null);
    const [showGasLink, setShowGasLink] = useState(false);

    // Fetch rate and status
    useEffect(() => {
        api.get('/swap/rate').then(res => setRate(res.data)).catch(console.error);

        // Use dashboard stats for global/user status if not already available via a specific endpoint
        api.get('/dashboard/stats').then(res => {
            if (res.data.swap) {
                setSwapStatus(res.data.swap);
            }
        }).catch(console.error);
    }, []);

    // Cooldown Timer Logic
    useEffect(() => {
        if (user?.at_balance !== undefined) {
            setAmountAT(user.at_balance || '0');
        }
    }, [user?.at_balance]);

    useEffect(() => {
        if (!user?.next_swap_at) {
            setCooldownTime(null);
            return;
        }

        const updateTimer = () => {
            const nextSwapAt = user?.next_swap_at;
            if (!nextSwapAt) return;
            const now = new Date();
            // Force UTC parsing and handle potential space gaps in date strings
            const nextSwapStr = nextSwapAt.replace(' ', 'T');
            const nextSwap = new Date(nextSwapStr.endsWith('Z') || nextSwapStr.includes('+') ? nextSwapStr : nextSwapStr + 'Z');
            const diff = nextSwap.getTime() - now.getTime();

            if (diff <= 0) {
                setCooldownTime(null);
                return;
            }

            const h = Math.floor(diff / (1000 * 60 * 60));
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setCooldownTime(`${h}h ${m}m ${s}s`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [user?.next_swap_at]);

    const fee = (fromToken === 'AT') ? (rate ? rate.fee_percent : 1) : 0;
    const exchangeRate = (fromToken === 'AT') ? (rate ? rate.rate : 1) : 1;
    const calculatedReceive = useMemo(() => {
        if (!amountAT || isNaN(parseFloat(amountAT))) return 0;
        const gross = parseFloat(amountAT) * exchangeRate;
        return gross * (1 - fee / 100);
    }, [amountAT, exchangeRate, fee]);

    // Token change logic removed as per requirements (AT -> ATH only)

    // Simplified status polling removed as swaps are now instant

    const handleSwap = async () => {
        if (user?.kyc_status !== 'approved') {
            const statusMsg = user?.kyc_status === 'pending' ? 'Your KYC pending' :
                user?.kyc_status === 'rejected' ? 'Your KYC rejected' :
                    'Your KYC not Approved then swap open';
            showAlert('warning', statusMsg);
            return;
        }
        if (swapStatus?.isGloballyActive === false) {
            showAlert('warning', 'Network Protocol Offline: The global swap extraction system is currently undergoing maintenance. Please check back later.');
            return;
        }
        if (swapStatus?.isPaused) {
            showAlert('danger', 'Swap Access Restricted: Your account swap protocol has been suspended by administration.');
            return;
        }
        if (!amountAT || parseFloat(amountAT) <= 0) {
            showAlert('warning', 'No AT balance detected for swap.');
            return;
        }

        setLoading(true);
        setCurrentStep(0); // Validating

        try {
            setCurrentStep(1); // Processing

            const res = await api.post('/swap/execute', {
                amountAT: parseFloat(user?.at_balance || amountAT),
                fromToken: 'AT',
                toToken: 'ATH'
            });

            if (res.data.status === 'completed' || res.data.status === 'success') {
                setSuccess({
                    txHash: res.data.txHash || res.data.hash,
                    claimableATH: res.data.amount || calculatedReceive
                });
                setLoading(false);
                showAlert('success', 'Swap completed successfully');
                refreshUser();
            } else {
                setLoading(false);
                showAlert('info', 'Swap is processing in background.');
            }

        } catch (error: any) {
            setLoading(false);
            console.error('Swap Error:', error);
            const message = error.response?.data?.message || 'Swap sequence interrupted';
            showAlert('danger', message);
        }
    };

    const handleReset = () => {
        setAmountAT(user?.at_balance || '0');
        setSuccess(null);
        setLoading(false);
        setCurrentStep(0);
        setShowGasLink(false);
    };

    const copyToClipboard = () => {
        if (successData?.txHash) {
            navigator.clipboard.writeText(successData.txHash)
                .then(() => showAlert('success', 'Transaction Hash copied'))
                .catch(() => showAlert('error', 'Failed to copy hash'));
        }
    };

    const viewState = loading ? "processing" : successData ? "success" : "input";

    return (
        <div className="min-h-[calc(100vh-var(--header-height))] w-full bg-background text-foreground flex flex-col items-center justify-start pt-12 md:pt-20 relative overflow-hidden font-body selection:bg-foreground selection:text-background">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--foreground-rgb),0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--foreground-rgb),0.03)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

            <main className="w-full max-w-[480px] p-4 sm:p-6 z-10">
                <AnimatePresence mode="wait">

                    {viewState === "input" && (
                        <motion.div
                            key="input"
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
                            className="w-full"
                        >
                            <div className="mb-6 text-center">
                                <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">Swap Tokens</h1>
                                <p className="text-muted-foreground text-sm">Instant automated liquidity exchange</p>
                            </div>

                            {cooldownTime && fromToken === 'AT' && (rate?.cooldown_enabled !== false) && (
                                <div className="mb-4 p-3 bg-secondary/50 border border-border rounded-xl flex items-center justify-between px-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Clock className="w-4 h-4" />
                                        <span>Daily Limit Reached</span>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-foreground">{cooldownTime}</span>
                                </div>
                            )}

                            <div className="relative bg-card rounded-3xl border border-border p-2 shadow-2xl shadow-background/50">
                                <div className="flex flex-col gap-1 relative">
                                    <CurrencyInput
                                        label="AT"
                                        symbol="AT"
                                        value={amountAT}
                                        readOnly
                                        className="border-none bg-secondary/50"
                                        disabled
                                    />

                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                                        <div className="p-2 rounded-xl bg-background border border-border shadow-xl">
                                            <ArrowDown className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </div>

                                    <CurrencyInput
                                        label="ATH"
                                        symbol="ATH"
                                        value={calculatedReceive.toFixed(4)}
                                        readOnly
                                        className="border-none bg-secondary/20"
                                        disabled
                                    />
                                </div>

                                {/* Swap Summary Card */}
                                <div className="mt-6">
                                    <Card className="bg-secondary/40 border border-border rounded-2xl p-5">

                                        <div className="text-[10px] font-bold text-foreground/40 uppercase tracking-[0.2em] pb-4 border-b border-border/30">
                                            Swap Summary
                                        </div>

                                        <div className="space-y-4 pt-4 font-mono">
                                            <div className="space-y-1">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">Tokens</p>
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-xs font-medium text-muted-foreground">AT</span>
                                                    <span className="text-sm font-bold text-foreground tabular-nums">{parseFloat(amountAT || '0').toLocaleString()}</span>
                                                </div>
                                            </div>

                                            <div className="space-y-1">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">Digital Assets</p>
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-xs font-medium text-muted-foreground">ATH</span>
                                                    <span className="text-sm font-bold text-foreground tabular-nums">{calculatedReceive.toFixed(4)}</span>
                                                </div>
                                            </div>

                                            <div className="pt-2 space-y-2 font-sans border-t border-border/30">
                                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                                    <span className="uppercase tracking-wider opacity-60">Swap Fee</span>
                                                    <span className="text-foreground font-bold">0%</span>
                                                </div>

                                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                                    <span className="uppercase tracking-wider opacity-60">
                                                        Processing Time
                                                    </span>
                                                    <span className="text-foreground font-bold text-right">
                                                        Up to 24–48 hours
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>

                                {user?.kyc_status !== 'approved' && (
                                    <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-start gap-3">
                                        <AlertCircle className="w-4 h-4 text-orange-500 mt-0.5" />
                                        <div className="flex-1">
                                            <p className="text-[10px] font-bold text-orange-500 uppercase tracking-wider">KYC Requirement</p>
                                            <p className="text-[10px] text-orange-500/70 uppercase leading-relaxed font-bold">
                                                {user?.kyc_status === 'pending' ? 'Your KYC pending' :
                                                    user?.kyc_status === 'rejected' ? 'Your KYC rejected' :
                                                        'Your KYC not Approved then swap open'}
                                            </p>
                                            {(user?.kyc_status === 'unverified' || user?.kyc_status === 'rejected') && (
                                                <button
                                                    onClick={() => window.location.href = '/dashboard/kyc'}
                                                    className="mt-2 text-[10px] font-bold text-orange-500 underline uppercase tracking-widest hover:text-orange-600 transition-colors block"
                                                >
                                                    Complete KYC
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Removed gas warning as it is no longer required in centralized system */}

                                <button
                                    onClick={handleSwap}
                                    disabled={!amountAT || parseFloat(amountAT) <= 0 || loading || (!!cooldownTime && (rate?.cooldown_enabled !== false)) || user?.kyc_status !== 'approved'}
                                    className={cn(
                                        "w-full py-4 rounded-xl font-semibold text-sm transition-all duration-300",
                                        "shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0",
                                        (!amountAT || parseFloat(amountAT) <= 0 || (!!cooldownTime && (rate?.cooldown_enabled !== false)) || user?.kyc_status !== 'approved')
                                            ? "bg-secondary text-muted-foreground cursor-not-allowed shadow-none"
                                            : "bg-foreground text-background hover:opacity-90 shadow-foreground/10"
                                    )}
                                >
                                    {loading ? "Processing..." : "Initiate Swap"}
                                </button>

                                {showGasLink && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="mt-4"
                                    >
                                        <Button
                                            variant="outline"
                                            onClick={() => window.location.href = '/dashboard/wallet?action=claim'}
                                            className="w-full border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all text-xs font-bold py-6 rounded-xl"
                                        >
                                            You Dont have Gas fee click this
                                        </Button>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {viewState === "processing" && (
                        <motion.div
                            key="processing"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            transition={{ duration: 0.4 }}
                            className="flex flex-col items-center justify-center py-12"
                        >
                            <div className="relative mb-8">
                                <div className="absolute inset-0 bg-foreground/20 blur-xl rounded-full animate-pulse" />
                                <div className="relative w-20 h-20 rounded-full border-2 border-border border-t-foreground animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <RefreshCw className="w-6 h-6 text-foreground animate-pulse" />
                                </div>
                            </div>
                            <h2 className="text-xl font-semibold text-foreground mb-2">Processing Transaction</h2>
                            <p className="text-muted-foreground text-sm animate-pulse font-mono text-center">
                                {currentStep === 2
                                    ? "Your transaction is in the queue. Please wait a moment."
                                    : (SWAP_STEPS[currentStep]?.label || "Finalizing...")}
                            </p>
                        </motion.div>
                    )}

                    {viewState === "success" && (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, type: "spring", stiffness: 100 }}
                            className="w-full"
                        >
                            <div className="bg-card rounded-3xl border border-border p-8 text-center shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-foreground/50 to-transparent" />

                                <div className="w-16 h-16 bg-foreground rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-foreground/20">
                                    <Check className="w-8 h-8 text-background" />
                                </div>

                                <h2 className="text-2xl font-bold text-foreground mb-2">Swap Confirmed</h2>
                                <p className="text-muted-foreground text-sm mb-8">
                                    Successfully swapped <span className="text-foreground font-mono">{parseFloat(amountAT).toFixed(2)} {fromToken}</span> for <span className="text-foreground font-mono">{parseFloat(successData?.claimableATH).toFixed(fromToken === 'AT' ? 4 : 6)} {toToken}</span>
                                </p>

                                <div className="bg-secondary/50 rounded-xl p-4 mb-8 text-left border border-border">
                                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Transaction Hash</p>
                                    <div className="flex items-center justify-between gap-3 font-mono text-sm text-foreground/80">
                                        <span className="truncate">{successData?.txHash || "0x..."}</span>
                                        <button
                                            onClick={copyToClipboard}
                                            className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                                        >
                                            <Copy className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <button
                                    onClick={handleReset}
                                    className="w-full py-4 rounded-xl bg-foreground text-background font-semibold hover:opacity-90 transition-colors shadow-lg shadow-foreground/10 active:scale-[0.98] duration-200"
                                >
                                    Make Another Swap
                                </button>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </main>
        </div >
    );
}


