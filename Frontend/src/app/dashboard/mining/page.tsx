'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Zap, Activity, Shield, Lock,
    Cpu, Globe, Database, Bell
} from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { useAuth } from '@/providers/AuthProvider';
import { useAlert } from '@/providers/AlertProvider';
import { NotificationService } from '@/services/notification';
import { useAdProtection } from '@/hooks/useAdProtection';
import { useFinancialOperation } from '@/hooks/useFinancialOperation';
import { PendingTransaction } from '@/components/wallet/PendingTransaction';
import { BoostReceipt, financialError, MiningReceipt } from '@/services/financial';

const MINING_STEPS = [
    { id: 'validate', label: 'Validating Neural Identity' },
    { id: 'auth', label: 'Authenticating Neural Link' },
    { id: 'sync', label: 'Synchronizing Ledger State' },
    { id: 'extract', label: 'Extracting Protocol AT' },
    { id: 'finalize', label: 'Finalizing Transaction' }
];

export default function MiningPage() {
    const { user, refreshUser } = useAuth();
    const { showAlert } = useAlert();
    const { withAdProtection } = useAdProtection();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<any>(null);
    const [timeLeft, setTimeLeft] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    const [successReward, setSuccessReward] = useState<number | null>(null);
    const mining = useFinancialOperation<Record<string, never>, MiningReceipt>('/mining/start');
    const boost = useFinancialOperation<Record<string, never>, BoostReceipt>('/mining/claim-boost');

    const fetchStatus = async () => {
        try {
            const res = await api.get('/mining/status');
            setStatus(res.data);
            setTimeLeft(res.data.timeLeft);
        } catch (error) {
            console.error(error);
        }
    };


    useEffect(() => {
        fetchStatus();
        const timer = setInterval(() => setTimeLeft(prev => Math.max(0, prev - 1)), 1000);
        const poll = setInterval(() => void fetchStatus(), 15000);
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'PLAY_NOTIFICATION_SOUND') NotificationService.playSound();
        };

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleMessage);
        }
        return () => {
            clearInterval(timer);
            clearInterval(poll);
            if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('message', handleMessage);
        };
    }, []);

    const handleMining = async (retry = false) => {
        if (loading || mining.busy || boost.busy) return;
        if (!retry && status?.isGloballyActive === false) {
            showAlert('warning', 'Network Protocol Offline: The global mining extraction system is currently undergoing maintenance. Please check back later.');
            return;
        }
        if (!retry && status?.userMiningPaused) {
            showAlert('danger', 'Mining Access Restricted: Your account mining protocol has been suspended by administration.');
            return;
        }
        if (!retry && (timeLeft > 0 || !status?.canMine)) return;

        setLoading(true);
        setCurrentStep(0);
        setSuccessReward(null);
        try {
            // A retry must bypass validation/cooldown and recover the committed receipt.
            if (!retry) await api.post('/mining/validate');
            setCurrentStep(2);
            const receipt = retry ? await mining.retry() : await mining.execute({});
            setCurrentStep(MINING_STEPS.length);
            setSuccessReward(receipt.reward);
            if (receipt.historyPending) showAlert('info', 'Mining reward confirmed. Transaction history is syncing.');
            void fetchStatus();
            void refreshUser().catch(() => {});
        } catch (error: any) {
            showAlert('danger', financialError(error));
            void fetchStatus();
        } finally { setLoading(false); }
    };

    const handleBoost = async (retry = false) => {
        if (loading || mining.busy || boost.busy) return;
        setLoading(true);
        try {
            const receipt = retry ? await boost.retry() : await boost.execute({});
            showAlert('success', receipt.message);
            void fetchStatus();
            void refreshUser().catch(() => {});
        } catch (error) { showAlert('danger', financialError(error)); }
        finally { setLoading(false); }
    };

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const canMine = !!status?.canMine && timeLeft === 0 && !loading &&
        !mining.pending && !mining.checking && !mining.storageError;

    // Derived stats for display
    const displayStats = {
        yieldAmount: status?.currentYield ? `+${parseFloat(status.currentYield).toFixed(2)} AT` : "+1.00 AT",
        yieldPeriod: "24H",
        availableAssets: user?.at_balance ? parseFloat(user.at_balance).toFixed(2) : '0.00',
        miningStatus: status?.userMiningPaused ? "Restricted" : (loading ? "Mining..." : (timeLeft > 0 ? "Recharging" : "Active & Ready")),
    };

    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 lg:p-12 border-grid selection:bg-primary selection:text-primary-foreground font-sans relative overflow-hidden">
            {(mining.storageError || boost.storageError) && <p role="alert" className="text-destructive">{mining.storageError || boost.storageError}</p>}
            {mining.pending && <PendingTransaction description="Confirm the saved mining reward request."
                busy={loading} onRetry={() => void handleMining(true)} />}
            {boost.pending && <PendingTransaction description="Confirm the saved mining boost request."
                busy={loading} onRetry={() => void handleBoost(true)} />}
            {/* Mining Progress Overlay */}
            <AnimatePresence>
                {loading && !successReward && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
                    >
                        <div className="max-w-md w-full space-y-12">
                            {/* Animated Scanner Effect */}
                            <div className="relative w-32 h-32 mx-auto">
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 border-2 border-dashed border-primary/30 rounded-full"
                                />
                                <motion.div
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-4 border border-dotted border-primary/20 rounded-full"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Cpu className="w-10 h-10 text-primary animate-pulse" />
                                </div>
                                <motion.div
                                    animate={{
                                        top: ["0%", "100%", "0%"],
                                        opacity: [0, 1, 0]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 right-0 h-0.5 bg-primary/50 shadow-[0_0_15px_rgba(var(--primary),0.5)] z-10"
                                />
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <h2 className="text-xl font-mono tracking-tighter uppercase text-primary">Protocol Extraction Active</h2>
                                    <p className="text-sm text-muted-foreground font-mono">Initializing secure node link...</p>
                                </div>

                                <div className="space-y-4">
                                    {MINING_STEPS.map((step, idx) => (
                                        <div key={step.id} className="flex items-center gap-4 text-left">
                                            <div className="relative flex items-center justify-center">
                                                {currentStep > idx ? (
                                                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                                        <Activity className="w-3 h-3 text-primary" />
                                                    </div>
                                                ) : currentStep === idx ? (
                                                    <div className="w-5 h-5 rounded-full border border-primary/50 flex items-center justify-center">
                                                        <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                                                    </div>
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full border border-border" />
                                                )}
                                                {idx < MINING_STEPS.length - 1 && (
                                                    <div className={`absolute top-5 bottom-[-16px] w-[1px] ${currentStep > idx ? 'bg-primary/30' : 'bg-border'}`} />
                                                )}
                                            </div>
                                            <span className={`text-xs font-mono uppercase tracking-widest ${currentStep >= idx ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                                                {step.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <p className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-[0.3em] animate-pulse">
                                Do not refresh or close neural connection
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Success Overlay */}
            <AnimatePresence>
                {successReward && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.1 }}
                        className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-2xl flex items-center justify-center p-6"
                    >
                        <div className="max-w-lg w-full bg-card border border-primary/20 p-8 md:p-12 relative overflow-hidden shadow-[0_0_50px_rgba(var(--primary),0.1)]">
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

                            <div className="relative z-10 space-y-10">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-primary/10 border border-primary/20 flex items-center justify-center rounded-sm">
                                        <Zap className="w-6 h-6 text-primary" />
                                    </div>
                                    <div className="h-px flex-1 bg-border" />
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.4em]">Protocol-Extract-Complete</span>
                                </div>

                                <div className="space-y-6 text-center">
                                    <div className="space-y-1">
                                        <h3 className="text-3xl font-light tracking-tighter uppercase text-foreground">Extraction Successful</h3>
                                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Network Rewards Settled</p>
                                    </div>

                                    <div className="py-8 border-y border-border">
                                        <motion.div
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 0.2 }}
                                            className="text-6xl font-mono font-bold text-primary tracking-tighter"
                                        >
                                            +{successReward}
                                            <span className="text-lg text-muted-foreground ml-2">AT</span>
                                        </motion.div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-left font-mono text-[10px]">
                                        <div className="space-y-1 opacity-60">
                                            <p className="uppercase text-muted-foreground">Protocol Step</p>
                                            <p className="text-foreground">VALIDATED EXTRACTION</p>
                                        </div>
                                        <div className="space-y-1 opacity-60 text-right">
                                            <p className="uppercase text-muted-foreground">Auth Signature</p>
                                            <p className="text-foreground truncate">0x{Math.random().toString(16).slice(2, 10).toUpperCase()}...</p>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => setSuccessReward(null)}
                                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-mono uppercase tracking-widest"
                                >
                                    Return to Terminal
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="max-w-7xl mx-auto space-y-12">
                {/* Header Section */}
                <header className="space-y-4 border-b border-border pb-8">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-1">
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ duration: 0.5 }}
                                className="flex items-center gap-2"
                            >
                                <div className="w-2 h-2 bg-primary rounded-sm" />
                                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
                                    Node Reward
                                </h1>
                            </motion.div>
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-muted-foreground font-mono text-sm uppercase tracking-wider"
                            >
                                Mining Protocol // Automated Value Harvesting
                            </motion.p>
                        </div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="flex items-center gap-4 bg-muted/50 px-4 py-2 border border-border rounded-sm"
                        >
                            <StatusIndicator status="active" label="System Online" />
                            <div className="h-4 w-px bg-border" />
                            <span className="font-mono text-xs text-muted-foreground">v2.4.0-stable</span>
                        </motion.div>
                    </div>
                </header>

                {/* Dashboard Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* Protocol Status */}
                    <MetricCard title="Protocol Status" className="lg:col-span-1" delay={0.1}>
                        <div className="space-y-8">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground/60 uppercase tracking-wider">Protocol Yield</span>
                                    <Zap className="w-4 h-4 text-muted-foreground/60" />
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-mono font-medium text-foreground tracking-tighter glow-text">
                                        {displayStats.yieldAmount}
                                    </span>
                                    <span className="text-sm text-muted-foreground font-mono">
                                        / {displayStats.yieldPeriod}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-4 pt-6 border-t border-border">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Protocol Recharging</span>
                                </div>
                                {canMine ? (
                                    <button
                                        onClick={() => withAdProtection('mining', handleMining)}
                                        className="w-full py-3 bg-primary text-primary-foreground font-mono text-sm uppercase tracking-widest hover:opacity-90 transition-opacity rounded-sm active:scale-[0.98]"
                                    >
                                        Claim Reward
                                    </button>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-1.5 bg-primary/40 animate-pulse rounded-full" />
                                            <span className="text-xl font-mono text-foreground/80">
                                                {loading ? "PROCESSING..." : formatTime(timeLeft)}
                                            </span>
                                        </div>
                                        <div className="w-full bg-muted h-1 mt-2 overflow-hidden">
                                            <motion.div
                                                initial={{ width: "100%" }}
                                                animate={{ width: loading ? "100%" : "85%" }}
                                                className={`h-full ${loading ? 'bg-primary animate-pulse' : 'bg-foreground/30'}`}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Notifications Status */}
                            <div className="pt-4 border-t border-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-sm flex items-center justify-center bg-primary/10 border border-primary/20">
                                        <Bell className="w-4 h-4 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-mono text-foreground uppercase tracking-wider">Protocol Reminders</span>
                                        <span className="text-[9px] text-primary uppercase font-mono tracking-widest">
                                            Global on
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 border border-primary/10 rounded-full">
                                    <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                                    <span className="text-[8px] font-mono text-primary uppercase tracking-tighter">Active</span>
                                </div>
                            </div>
                        </div>
                    </MetricCard>

                    {/* Boost */}
                    <MetricCard title="Boost" className="md:col-span-1 lg:col-span-2" delay={0.2}>
                        <div className="flex flex-col h-full justify-between gap-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <h4 className="text-lg font-bold tracking-tight text-foreground uppercase">Daily Boost</h4>
                                    <p className="text-xs text-muted-foreground font-mono">Each boost adds +{status?.boostReward || '0.10'} AT to Protocol Yield</p>
                                </div>
                                <div className="flex flex-col items-end">
                                    <div className="text-2xl font-mono font-bold text-primary">
                                        {status?.currentCycleBoosts || 0} <span className="text-xs text-muted-foreground">/ {status?.maxBoosts || 3}</span>
                                    </div>
                                    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Boosts Used</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(((status?.currentCycleBoosts || 0) / (status?.maxBoosts || 3)) * 100, 100)}%` }}
                                        className={cn(
                                            "h-full transition-all duration-1000",
                                            (status?.currentCycleBoosts || 0) >= (status?.maxBoosts || 3) ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "bg-primary"
                                        )}
                                    />
                                </div>

                                <div className="flex flex-col gap-3">
                                    <Button
                                        disabled={(status?.currentCycleBoosts || 0) >= (status?.maxBoosts || 3) || loading || status?.boostEnabled !== true || boost.checking || !!boost.pending || !!boost.storageError}
                                        onClick={() => withAdProtection('boost', () => handleBoost())}
                                        className={cn(
                                            "w-full h-12 font-mono uppercase tracking-widest transition-all",
                                            status?.boostEnabled === false ? "bg-muted text-muted-foreground border border-border cursor-not-allowed opacity-50" :
                                                (status?.currentCycleBoosts || 0) >= (status?.maxBoosts || 3) ? "bg-green-500/10 text-green-500 border border-green-500/20 hover:bg-green-500/10 cursor-default" : "bg-primary hover:bg-primary/90"
                                        )}
                                    >
                                        {status?.boostEnabled === false ? "Boost Disabled" :
                                            (status?.currentCycleBoosts || 0) >= (status?.maxBoosts || 3) ? "All Boosts Used" : "Boost Protocol"}
                                    </Button>
                                    <p className="text-[9px] font-mono text-muted-foreground/60 uppercase text-center tracking-widest">
                                        Max {(status?.maxBoosts || 3)} boosts per cycle
                                    </p>
                                </div>
                            </div>
                        </div>
                    </MetricCard>

                    {/* Mining Assets */}
                    <MetricCard title="Mining Assets" subtitle="Real Time" className="lg:col-span-1" delay={0.3}>
                        <div className="space-y-8">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Available Assets</span>
                                    <Cpu className="w-4 h-4 text-muted-foreground/60" />
                                </div>
                                <div className="text-5xl font-mono font-medium text-foreground tracking-tighter">
                                    {displayStats.availableAssets}
                                    <span className="text-lg text-muted-foreground/60 ml-2">AT</span>
                                </div>
                            </div>

                            <div className="pt-6">
                                <div className="bg-muted/30 border border-border p-3 flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground font-mono">STATUS</span>
                                    <StatusIndicator status={loading ? "warning" : "active"} label={displayStats.miningStatus} />
                                </div>
                            </div>
                        </div>
                    </MetricCard>
                    {/* Node Power */}
                    <MetricCard title="Node Power" className="lg:col-span-1" delay={0.4}>
                        <div className="h-full flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-3xl font-mono text-foreground">Standard</span>
                                    <span className="text-xs text-muted-foreground">Server Configuration</span>
                                </div>
                                <Cpu className="w-5 h-5 text-muted-foreground/60" />
                            </div>

                            <div className="space-y-3 mt-6">
                                <div className="flex items-center justify-between text-sm font-mono text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Cpu className="w-3.5 h-3.5" />
                                        <span>CPU</span>
                                    </div>
                                    <span className="text-foreground">2 Core</span>
                                </div>
                                <div className="flex items-center justify-between text-sm font-mono text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Activity className="w-3.5 h-3.5" />
                                        <span>RAM</span>
                                    </div>
                                    <span className="text-foreground">4GB</span>
                                </div>
                                <div className="flex items-center justify-between text-sm font-mono text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Database className="w-3.5 h-3.5" />
                                        <span>STORAGE</span>
                                    </div>
                                    <span className="text-foreground">20GB SSD</span>
                                </div>
                            </div>

                            <div className="mt-6 p-2 bg-muted/30 border border-border/50 rounded-sm">
                                <p className="text-[9px] font-mono text-muted-foreground/60 uppercase text-center leading-tight">
                                    Node power on Ather Server not in your Device
                                </p>
                            </div>
                        </div>
                    </MetricCard>

                    {/* Safety Protocol */}
                    <MetricCard title="Safety Protocol" className="md:col-span-1 lg:col-span-1" delay={0.5}>
                        <div className="space-y-4">
                            <div className="flex items-start gap-4 p-4 border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                                <Shield className="w-6 h-6 text-muted-foreground mt-1 shrink-0" />
                                <div>
                                    <h4 className="text-sm font-medium text-foreground/80 mb-1">Ledger Sync</h4>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                        Neural mining processes are secured by off-chain ledger sync. All transactions are cryptographically verified.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                                <Lock className="w-6 h-6 text-muted-foreground mt-1 shrink-0" />
                                <div>
                                    <h4 className="text-sm font-medium text-foreground/80 mb-1">Zero-Gas</h4>
                                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                                        No gas fees required for internal AT extraction. Protocol covers all network overhead.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </MetricCard>


                    {/* Boost Card */}

                </div>

                {/* Footer */}

            </div>
        </div>
    );
}

