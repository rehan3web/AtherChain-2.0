'use client';

import { useState, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft,
    X, ShieldCheck, Copy, ArrowRight, ArrowLeft,
    Plus, Download, Repeat, Coins, Gift, AlertCircle, CheckCircle
} from 'lucide-react';
// import { ethers } from 'ethers'; // Moved to dynamic import where needed or handled by service

// import { toast } from 'sonner'; // Removed in favor of unified alerts
import { useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import Image from 'next/image';
import { useMemo } from 'react';

import { WalletService, Transaction } from '@/services/wallet';
import { StatusBadge } from '@/components/ui/StatusBadge';
import Success from '@/components/wallet/Success';
import Send from '@/components/wallet/Send';
import Receive from '@/components/wallet/Receive';
import ClaimModal from '@/components/wallet/ClaimModal';
import { CustomAlert, AlertType } from '@/components/CustomAlert';

interface WalletAlert {
    id: string;
    type: AlertType;
    message: string;
}

export default function WalletPage() {
    // State
    const [mode, setMode] = useState<'view' | 'send' | 'receive' | 'success'>('view');
    const [page, setPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [alerts, setAlerts] = useState<WalletAlert[]>([]);
    const [activeTab, setActiveTab] = useState<'assets' | 'transactions'>('assets');
    const [balances, setBalances] = useState<{ ath: string | null, wath: string | null, loading: boolean }>({
        ath: null,
        wath: null,
        loading: true
    });
    const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [claimSuccess, setClaimSuccess] = useState(false);

    const { resolvedTheme } = useTheme();
    const assetLogo = resolvedTheme === 'light' ? '/whitemode.png' : '/blackmode.png';

    // Alert System
    const addAlert = useCallback((type: AlertType, message: string) => {
        const id = Math.random().toString(36).substring(7);
        setAlerts(prev => [...prev, { id, type, message }]);

        // Auto-hide after 5 seconds
        setTimeout(() => {
            removeAlert(id);
        }, 5000);
    }, []);

    const removeAlert = useCallback((id: string) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    }, []);

    // Data Fetching
    const { data: stats, mutate: refreshStats, error: statsError } = useSWR('/wallet/stats', WalletService.getStats, {
        refreshInterval: 5000
    });

    // Handle SWR Errors
    useEffect(() => {
        if (statsError) {
            // Check if we already have this error to prevent spam
            setAlerts(prev => {
                if (prev.some(a => a.message === "Failed to fetch wallet stats")) return prev;
                return [...prev, { id: 'stats-error', type: 'error', message: "Failed to fetch wallet stats" }];
            });
        }
    }, [statsError]);

    const { data: transactionsData, mutate: refreshTx, isLoading: isTxLoading, error: txError } = useSWR(
        ['/transactions', page, searchTerm],
        () => WalletService.getTransactions(page, 6, searchTerm),
        { refreshInterval: 5000 }
    );

    const { data: claimData, mutate: refreshClaimStatus } = useSWR('/wallet/claim-status', WalletService.getClaimStatus);

    useEffect(() => {
        if (txError) {
            setAlerts(prev => {
                if (prev.some(a => a.message === "Failed to fetch transactions")) return prev;
                return [...prev, { id: 'tx-error', type: 'error', message: "Failed to fetch transactions" }];
            });
        }
    }, [txError]);

    // Blockchain Asset Fetching
    // Simplified balance syncing from backend-proxied stats
    const fetchBalances = useCallback(async () => {
        if (!stats) return;

        setBalances({
            ath: stats.ath_balance || '0.0000',
            wath: stats.wath_balance || '0.0000',
            loading: false
        });
    }, [stats]);

    useEffect(() => {
        fetchBalances();
    }, [fetchBalances]);

    const transactions = Array.isArray(transactionsData) ? transactionsData : (transactionsData?.data || []);
    const totalPages = transactionsData?.meta?.totalPages || 1;

    const router = useRouter();
    const searchParams = useSearchParams();

    // Handlers
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        addAlert("success", "Address copied to clipboard");
    };

    const handleSendTransaction = async (data: { recipient: string, amount: string }) => {
        return await WalletService.send(data);
    };

    const handleSendSuccess = (txData: any) => {
        refreshStats();
        refreshTx();

        // Show success alert
        addAlert("success", "Transaction sent successfully");

        const params = new URLSearchParams();
        params.set('hash', txData.txHash || txData.hash || "0x...");
        params.set('amount', txData.amount);
        params.set('from', stats?.wallet_address || "0x...");
        params.set('to', txData.recipient);
        params.set('fee', txData.fee || "0");
        params.set('block', txData.blockNumber || "PENDING");

        router.push(`?${params.toString()}`);
        setMode('success');
    };

    const handleLookup = async (identifier: string, type: 'email' | 'username') => {
        const result = await WalletService.lookupUser(identifier, type);
        return result.address;
    };

    const handleClaimClick = useCallback(() => {
        if (stats?.kyc_status !== 'approved') {
            addAlert("error", "Only KYC verified users can claim bridge fee.");
            return;
        }

        // Already claimed check
        if (claimData) {
            if (claimData.status === 'sent') {
                addAlert("error", "You have already claimed your swap fee.");
                return;
            }
            if (claimData.status === 'pending' || claimData.status === 'processing') {
                addAlert("error", "Your claim request is already being processed.");
                return;
            }
        }

        setIsClaimModalOpen(true);
    }, [stats, claimData, addAlert]);

    // Handle Action Redirects (e.g. from Swap page)
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'claim' && stats && !isClaimModalOpen) {
            handleClaimClick();
            // Clear the param without full refresh to prevent re-opening if user closes modal
            const newParams = new URLSearchParams(searchParams.toString());
            newParams.delete('action');
            router.replace(`?${newParams.toString()}`, { scroll: false });
        }
    }, [searchParams, stats, isClaimModalOpen, router, handleClaimClick]);

    // Keep selectedTx in sync with background data refresh
    useEffect(() => {
        if (selectedTx) {
            const updatedTx = transactions.find((t: Transaction) => (t.id || t.txHash) === (selectedTx.id || selectedTx.txHash));
            if (updatedTx && JSON.stringify(updatedTx) !== JSON.stringify(selectedTx)) {
                setSelectedTx(updatedTx);
            }
        }
    }, [transactions, selectedTx]);

    const handleConfirmClaim = async () => {
        setIsClaiming(true);
        try {
            await WalletService.requestClaim();
            refreshClaimStatus();
            setClaimSuccess(true);
            setTimeout(() => {
                setClaimSuccess(false);
                setIsClaimModalOpen(false);
                router.push('/dashboard');
            }, 5000);
        } catch (error: any) {
            addAlert("error", error.response?.data?.message || "Failed to process claim");
        } finally {
            setIsClaiming(false);
        }
    };

    // View Content Logic
    let content;
    if (searchParams.get('hash')) {
        content = <Success />;
    } else if (mode === 'receive') {
        content = (
            <Receive
                walletAddress={stats?.wallet_address}
                email={stats?.email}
                username={stats?.username}
                onBack={() => setMode('view')}
                onAlert={addAlert}
            />
        );
    } else if (mode === 'send') {
        content = (
            <Send
                walletBalance={stats?.ath_balance}
                fromAddress={stats?.wallet_address}
                isTransferEnabled={stats?.is_transfer_enabled}
                transferPaused={stats?.transfer_paused}
                isGloballyActive={stats?.is_globally_active}
                onSend={handleSendTransaction}
                onLookup={handleLookup}
                onSuccess={handleSendSuccess}
                onCancel={() => setMode('view')}
                onAlert={addAlert}
            />
        );
    } else {
        // Default View
        content = (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-8 w-full"
            >
                {/* Main Balance Display */}
                <div className="bg-card border border-border p-8 md:p-10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-10 opacity-5 transition-transform group-hover:scale-110 duration-700">
                        <Image
                            src={assetLogo}
                            alt="ATH Logo"
                            width={120}
                            height={120}
                            className="object-contain grayscale"
                        />
                    </div>

                    <div className="relative z-10 space-y-6">
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground mb-4">Ather Network Assets</p>
                            <div className="flex flex-baseline gap-2">
                                <h2 className="text-5xl md:text-6xl font-light tracking-tighter text-foreground">
                                    {balances.ath === null ? (stats?.ath_balance || '...') : parseFloat(balances.ath).toFixed(4)}
                                </h2>
                                <span className="text-sm font-bold uppercase tracking-widest text-foreground pb-2">ATH</span>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-border/50 inline-block">
                            <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-foreground">
                                        {stats?.at_balance ? parseFloat(stats.at_balance).toLocaleString() : '0.00'} <span className="text-[9px] font-mono text-muted-foreground ml-1 uppercase">AT Tokens</span>
                                    </p>
                                    <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Protocol Rewards Available</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
                </div>

                {/* Header Action Buttons */}
                {/* Header Action Buttons - Modern Quick Action Style */}
                <div className="grid grid-cols-4 gap-2 md:gap-4">
                    {/* SEND */}
                    <button
                        onClick={() => setMode('send')}
                        className="group relative flex flex-col items-center justify-center p-3 md:p-5 rounded-2xl md:rounded-[2rem] border border-border/40 bg-card/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-card/60 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
                    >
                        <div className="mb-2 md:mb-4 relative">
                            <div className="absolute inset-0 scale-75 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative size-10 md:size-14 rounded-xl md:rounded-2xl bg-linear-to-br from-muted/80 to-muted/40 flex items-center justify-center group-hover:from-primary group-hover:to-primary/80 transition-all duration-500 shadow-sm group-hover:shadow-lg group-hover:shadow-primary/20">
                                <ArrowUpRight className="size-5 md:size-6 text-muted-foreground group-hover:text-primary-foreground transition-colors duration-500" />
                            </div>
                        </div>
                        <span className="text-[10px] md:text-[13px] font-semibold text-foreground/70 group-hover:text-foreground transition-colors duration-500 text-center tracking-tight px-1 line-clamp-1 md:line-clamp-none uppercase">
                            Send
                        </span>
                        <div className="absolute inset-1 rounded-xl md:rounded-[1.7rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none border border-primary/10 ring-1 ring-inset ring-white/5 dark:ring-white/10" />
                    </button>

                    {/* RECEIVE */}
                    <button
                        onClick={() => setMode('receive')}
                        className="group relative flex flex-col items-center justify-center p-3 md:p-5 rounded-2xl md:rounded-[2rem] border border-border/40 bg-card/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-card/60 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
                    >
                        <div className="mb-2 md:mb-4 relative">
                            <div className="absolute inset-0 scale-75 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative size-10 md:size-14 rounded-xl md:rounded-2xl bg-linear-to-br from-muted/80 to-muted/40 flex items-center justify-center group-hover:from-primary group-hover:to-primary/80 transition-all duration-500 shadow-sm group-hover:shadow-lg group-hover:shadow-primary/20">
                                <ArrowDownLeft className="size-5 md:size-6 text-muted-foreground group-hover:text-primary-foreground transition-colors duration-500" />
                            </div>
                        </div>
                        <span className="text-[10px] md:text-[13px] font-semibold text-foreground/70 group-hover:text-foreground transition-colors duration-500 text-center tracking-tight px-1 line-clamp-1 md:line-clamp-none uppercase">
                            Receive
                        </span>
                        <div className="absolute inset-1 rounded-xl md:rounded-[1.7rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none border border-primary/10 ring-1 ring-inset ring-white/5 dark:ring-white/10" />
                    </button>

                    {/* SWAP */}
                    <button
                        onClick={() => router.push('/dashboard/swap')}
                        className="group relative flex flex-col items-center justify-center p-3 md:p-5 rounded-2xl md:rounded-[2rem] border border-border/40 bg-card/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-card/60 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
                    >
                        <div className="mb-2 md:mb-4 relative">
                            <div className="absolute inset-0 scale-75 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative size-10 md:size-14 rounded-xl md:rounded-2xl bg-linear-to-br from-muted/80 to-muted/40 flex items-center justify-center group-hover:from-primary group-hover:to-primary/80 transition-all duration-500 shadow-sm group-hover:shadow-lg group-hover:shadow-primary/20">
                                <Repeat className="size-5 md:size-6 text-muted-foreground group-hover:text-primary-foreground transition-colors duration-500" />
                            </div>
                        </div>
                        <span className="text-[10px] md:text-[13px] font-semibold text-foreground/70 group-hover:text-foreground transition-colors duration-500 text-center tracking-tight px-1 line-clamp-1 md:line-clamp-none uppercase">
                            Swap
                        </span>
                        <div className="absolute inset-1 rounded-xl md:rounded-[1.7rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none border border-primary/10 ring-1 ring-inset ring-white/5 dark:ring-white/10" />
                    </button>

                    {/* CLAIM */}
                    <button
                        onClick={handleClaimClick}
                        className="group relative flex flex-col items-center justify-center p-3 md:p-5 rounded-2xl md:rounded-[2rem] border border-border/40 bg-card/40 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:bg-card/60 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30"
                    >
                        <div className="mb-2 md:mb-4 relative">
                            <div className="absolute inset-0 scale-75 blur-xl bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                            <div className="relative size-10 md:size-14 rounded-xl md:rounded-2xl bg-linear-to-br from-muted/80 to-muted/40 flex items-center justify-center group-hover:from-primary group-hover:to-primary/80 transition-all duration-500 shadow-sm group-hover:shadow-lg group-hover:shadow-primary/20">
                                <Gift className="size-5 md:size-6 text-muted-foreground group-hover:text-primary-foreground transition-colors duration-500" />
                            </div>
                        </div>
                        <span className="text-[10px] md:text-[13px] font-semibold text-foreground/70 group-hover:text-foreground transition-colors duration-500 text-center tracking-tight px-1 line-clamp-1 md:line-clamp-none uppercase">
                            Claim
                        </span>
                        <div className="absolute inset-1 rounded-xl md:rounded-[1.7rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none border border-primary/10 ring-1 ring-inset ring-white/5 dark:ring-white/10" />
                    </button>
                </div>

                {/* Main Content Area with Tabs */}
                <div className="space-y-6">
                    {/* Tab Navigation */}
                    <div className="flex border-b border-border">
                        <button
                            onClick={() => setActiveTab('assets')}
                            className={`flex-1 px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === 'assets' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Assets
                            {activeTab === 'assets' && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('transactions')}
                            className={`flex-1 px-8 py-4 text-[10px] font-bold uppercase tracking-[0.2em] transition-all relative ${activeTab === 'transactions' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            Transactions
                            {activeTab === 'transactions' && (
                                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                            )}
                        </button>
                    </div>

                    <AnimatePresence mode="wait">
                        {activeTab === 'assets' ? (
                            <motion.div
                                key="assets"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                transition={{ duration: 0.2 }}
                                className="grid grid-cols-1 gap-4"
                            >
                                {/* ATH Asset Card */}
                                <div className="bg-card border border-border p-6 flex items-center justify-between group hover:border-foreground/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-secondary border border-border flex items-center justify-center overflow-hidden">
                                            <Image
                                                src={assetLogo}
                                                alt="ATH"
                                                width={24}
                                                height={24}
                                                className="object-contain"
                                            />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-foreground">ATH</h4>
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Native Token</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-light tracking-tighter">
                                            {balances.ath === null ? (stats?.ath_balance || '...') : parseFloat(balances.ath).toFixed(4)}
                                        </p>
                                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mt-1">Mainnet Portfolio</p>
                                    </div>
                                </div>

                                {/* AT Asset Card */}
                                <div className="bg-card border border-border p-6 flex items-center justify-between group hover:border-foreground/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-secondary border border-border flex items-center justify-center overflow-hidden">
                                            <Image
                                                src={assetLogo}
                                                alt="AT"
                                                width={24}
                                                height={24}
                                                className="object-contain"
                                            />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-foreground">AT</h4>
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Reward Token</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-light tracking-tighter">
                                            {stats?.at_balance ? parseFloat(stats.at_balance).toLocaleString() : '0.00'}
                                        </p>
                                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mt-1">Mining Rewards</p>
                                    </div>
                                </div>

                                {/* WATH Asset Card */}
                                <div className="bg-card border border-border p-6 flex items-center justify-between group hover:border-foreground/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-secondary border border-border flex items-center justify-center overflow-hidden">
                                            <Image
                                                src={assetLogo}
                                                alt="WATH"
                                                width={24}
                                                height={24}
                                                className="object-contain"
                                            />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-foreground">WATH</h4>
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Wrapped Token</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-light tracking-tighter">
                                            {balances.wath === null ? '0.0000' : parseFloat(balances.wath).toFixed(4)}
                                        </p>
                                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mt-1">Protocol Secured</p>
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="transactions"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-6"
                            >
                                {/* Transaction List (Moved from original location) */}
                                <div className="bg-card border border-border min-h-[400px]">
                                    <div className="p-4 border-b border-border bg-secondary/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <h3 className="text-xs font-mono uppercase tracking-widest text-muted-foreground whitespace-nowrap">Recent Activity</h3>
                                        <div className="relative flex-1 max-w-sm">
                                            <input
                                                type="text"
                                                placeholder="Search by Hash..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-secondary border border-border px-3 py-1.5 text-[10px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30 transition-colors"
                                            />
                                        </div>
                                    </div>

                                    {isTxLoading ? (
                                        <div className="p-12 text-center text-muted-foreground font-mono text-sm">Loading blockchain data...</div>
                                    ) : transactions.length === 0 ? (
                                        <div className="p-12 text-center text-muted-foreground font-mono text-sm">No transactions found.</div>
                                    ) : (
                                        <div className="divide-y divide-border">
                                            {transactions.map((tx: Transaction) => (
                                                <div
                                                    key={tx.id || tx.txHash}
                                                    onClick={() => setSelectedTx(tx)}
                                                    className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-secondary transition-colors group cursor-pointer gap-4"
                                                >
                                                    <div className="flex items-center gap-4 flex-1 min-w-0">
                                                        <div className={`w-8 h-8 md:w-10 md:h-10 flex-shrink-0 flex items-center justify-center border ${tx.type === 'receive' ? 'border-green-500/30 text-green-500' : 'border-border text-foreground'}`}>
                                                            {tx.type === 'receive' ? <ArrowDownLeft className="w-4 h-4 md:w-5 md:h-5" /> : <ArrowUpRight className="w-4 h-4 md:w-5 md:h-5" />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold text-foreground uppercase tracking-wide truncate">{tx.type.replace('_', ' ')}</p>
                                                            <p className="text-[10px] font-mono text-muted-foreground truncate">
                                                                {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'Date Pending'} • <span className="hidden sm:inline">{tx.txHash}</span><span className="sm:hidden">{tx.txHash?.slice(0, 10)}...</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex sm:flex-col justify-between items-end gap-1 flex-shrink-0">
                                                        <p className={`font-mono font-bold text-sm md:text-base ${tx.type === 'receive' || tx.type === 'mining' || tx.type.startsWith('mine_') ? 'text-green-500' : 'text-foreground'}`}>
                                                            {tx.type === 'swap' && tx.metadata?.fromToken ? (
                                                                <span className="flex flex-col items-end">
                                                                    <span className="text-red-500/80 text-[10px] leading-tight flex items-center gap-1">
                                                                        -{tx.metadata.fromAmount} {tx.metadata.fromToken}
                                                                    </span>
                                                                    <span className="text-green-500 leading-tight">
                                                                        +{tx.metadata.toAmount} {tx.metadata.toToken}
                                                                    </span>
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    {tx.type === 'receive' || tx.type === 'mining' || tx.type.startsWith('mine_') ? '+' : '-'}{tx.amount} {tx.type === 'mining' || tx.type.startsWith('mine_') ? 'AT' : 'ATH'}
                                                                </>
                                                            )}
                                                        </p>
                                                        <StatusBadge status={tx.status} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Pagination */}
                                    <div className="p-4 border-t border-border flex items-center justify-between bg-muted/20">
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase">
                                            Page {page} of {totalPages}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                disabled={page === 1}
                                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                                className="px-3 py-1 border border-border text-[10px] font-mono uppercase text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                            >
                                                Back
                                            </button>
                                            <button
                                                disabled={page >= totalPages}
                                                onClick={() => setPage(p => p + 1)}
                                                className="px-3 py-1 border border-border text-[10px] font-mono uppercase text-foreground hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>

                {/* Transaction Details Modal */}
                <AnimatePresence>
                    {selectedTx && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="w-full max-w-2xl bg-card border border-border shadow-2xl relative"
                            >
                                <div className="p-8 relative">

                                    {/* Close Button */}
                                    <button
                                        onClick={() => setSelectedTx(null)}
                                        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>

                                    {/* Header */}
                                    <div className="flex items-center gap-3 mb-8">
                                        <ShieldCheck className="w-6 h-6 text-foreground" />
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.4em]">
                                            Transaction Receipt
                                        </span>
                                    </div>

                                    {/* Status + Amount */}
                                    <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-10">
                                        <div>
                                            <h3 className="text-2xl font-light uppercase tracking-tight">
                                                {selectedTx.status === 'completed'
                                                    ? 'SUCCESSFUL'
                                                    : selectedTx.status.toUpperCase()}
                                            </h3>
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                                                {selectedTx.type === 'receive'
                                                    ? 'Digital Asset Receipt'
                                                    : selectedTx.type === 'swap'
                                                        ? 'Token Exchange'
                                                        : 'Asset Transfer'}
                                            </p>
                                        </div>

                                        <div className="text-left md:text-right">
                                            {selectedTx.type === 'swap' && selectedTx.metadata?.fromToken ? (
                                                <div className="flex flex-col items-end gap-1">
                                                    <p className="text-xl font-mono font-bold tracking-tight text-red-500/80">
                                                        -{selectedTx.metadata.fromAmount} {selectedTx.metadata.fromToken}
                                                    </p>
                                                    <p className="text-2xl font-mono font-bold tracking-tight text-green-500">
                                                        +{selectedTx.metadata.toAmount} {selectedTx.metadata.toToken}
                                                    </p>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className={`text-3xl font-mono font-bold tracking-tight ${selectedTx.type === 'receive' || selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_') ? 'text-green-500' : ''}`}>
                                                        {selectedTx.type === 'receive' || selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_') ? '+' : '-'}
                                                        {selectedTx.amount}{' '}
                                                        {selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_') ? 'AT' : 'ATH'}
                                                    </p>
                                                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                                                        Network Settled
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Address Section */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 md:gap-x-12 border-t border-border pt-8 font-mono text-sm">

                                        {/* FROM */}
                                        <div>
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">
                                                From Address
                                            </p>
                                            <div className="bg-secondary/30 border border-border rounded-md px-3 py-2 overflow-x-auto">
                                                <p className="text-[11px] whitespace-nowrap">
                                                    {selectedTx.type === 'swap'
                                                        ? "0xED1c8bBFc2aCb5a13609F457646a15FF8F8bf520"
                                                        : selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_')
                                                            ? "System Protocol"
                                                            : (selectedTx.fromAddress || stats?.wallet_address || '0x...')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* TO */}
                                        <div className="md:text-right">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">
                                                To Address
                                            </p>
                                            <div className="bg-secondary/30 border border-border rounded-md px-3 py-2 overflow-x-auto">
                                                <p className="text-[11px] whitespace-nowrap">
                                                    {selectedTx.type === 'swap'
                                                        ? (selectedTx.metadata?.userAddress || stats?.wallet_address || '0x...')
                                                        : selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_')
                                                            ? "Your Node Account"
                                                            : (selectedTx.toAddress || selectedTx.recipient || stats?.wallet_address || '0x...')}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Block & Fee - Only for non-mining transactions */}
                                        {!(selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_')) && (
                                            <>
                                                {/* Block */}
                                                <div>
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">
                                                        Block Number
                                                    </p>
                                                    <p className="text-xs font-bold">
                                                        {selectedTx.blockNumber && selectedTx.blockNumber !== 'PENDING' ? `#${selectedTx.blockNumber}` : 'PENDING'}
                                                    </p>
                                                </div>

                                                {/* Fee */}
                                                <div className="md:text-right">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">
                                                        Network Fee
                                                    </p>
                                                    <p className="text-xs font-bold">
                                                        {selectedTx.fee || '0'} ATH
                                                    </p>
                                                </div>
                                            </>
                                        )}

                                        {/* Date */}
                                        <div>
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">
                                                Date
                                            </p>
                                            <p className="text-xs">
                                                {selectedTx.timestamp
                                                    ? new Date(selectedTx.timestamp).toLocaleString()
                                                    : 'N/A'}
                                            </p>
                                        </div>

                                        {/* TX Hash */}
                                        <div className="md:col-span-2">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-2">
                                                Transaction Hash
                                            </p>
                                            <div className="bg-secondary/30 border border-border rounded-md px-3 py-2 overflow-x-auto">
                                                <p className="text-[11px] whitespace-nowrap opacity-70">
                                                    {selectedTx.txHash}
                                                </p>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-10 w-full font-sans selection:bg-foreground selection:text-background">
            {/* Unified Alerts Area */}
            <div className="space-y-4 mb-8">
                <AnimatePresence mode="popLayout">
                    {alerts.map((alert) => (
                        <motion.div
                            key={alert.id}
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{ opacity: 1, y: 0, height: "auto" }}
                            exit={{ opacity: 0, y: -10, height: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <CustomAlert
                                type={alert.type}
                                onClose={() => removeAlert(alert.id)}
                            >
                                {alert.message}
                            </CustomAlert>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {/* Page Content */}
            {content}

            {/* Claim Modal & Full Page Loading/Success */}
            <AnimatePresence>
                {isClaimModalOpen && (
                    <ClaimModal
                        onClose={() => !isClaiming && setIsClaimModalOpen(false)}
                        onConfirm={handleConfirmClaim}
                        isLoading={isClaiming}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {(isClaiming || claimSuccess) && (
                    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/90 backdrop-blur-md p-6">
                        {isClaiming ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center gap-6"
                            >
                                <div className="relative w-24 h-24">
                                    <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                                    <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                                <h2 className="text-2xl font-light uppercase tracking-[0.2em]">Processing Your Claim...</h2>
                                <p className="text-xs text-muted-foreground font-mono uppercase">Network Authorization In Progress</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center gap-6 text-center max-w-md"
                            >
                                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-4">
                                    <CheckCircle className="w-10 h-10 text-background" />
                                </div>
                                <h2 className="text-3xl font-bold uppercase tracking-tighter">Request Received</h2>
                                <div className="space-y-4">
                                    <p className="text-sm text-foreground/80 leading-relaxed uppercase">
                                        Your claim fee request received.
                                        <br />
                                        Estimated arrival time: 24 hours.
                                    </p>
                                    <p className="text-[10px] font-mono text-muted-foreground uppercase">
                                        Auto redirecting to dashboard...
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
