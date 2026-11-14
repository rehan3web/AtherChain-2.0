'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import api from '@/lib/api';
import { ArrowUpRight, ArrowDownLeft, Pickaxe, RefreshCw, X, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useSWR from 'swr';
import { WalletService, Transaction } from '@/services/wallet';
import { useAuth } from '@/providers/AuthProvider';

export default function TransactionsPage() {
    const { user } = useAuth();
    const { data: history, isLoading: loading, error, mutate } = useSWR(
        user ? ['/transactions/history', user.id] : null, () => WalletService.getTransactions(1, 50), { refreshInterval: 5000 }
    );
    const data: Transaction[] = history?.data ?? [];
    const [selectedTx, setSelectedTx] = useState<any | null>(null);

    const truncate = (addr: string) => {
        if (!addr || addr.length < 20) return addr;
        return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
    };

    const getIcon = (type: string) => {
        const lowerType = type.toLowerCase();
        switch (lowerType) {
            case 'mining': return <Pickaxe size={18} className="text-foreground" />;
            case 'swap': return <RefreshCw size={18} className="text-primary" />;
            case 'claim': return <ArrowDownLeft size={18} className="text-green-500" />;
            case 'send':
            case 'transfer': return <ArrowUpRight size={18} className="text-muted-foreground" />;
            case 'receive': return <ArrowDownLeft size={18} className="text-foreground" />;
            case 'kyc_activation': return <ShieldCheck size={18} className="text-foreground" />;
            default: return <div className="w-4 h-4 bg-muted rounded-full" />;
        }
    };


    return (
        <div className="flex flex-col h-full space-y-4 md:space-y-6">
            {error && <p role="alert" className="text-destructive">Could not fetch transaction history.
                <button className="ml-3 underline" onClick={() => void mutate()}>Retry</button>
            </p>}

            <Card className="flex-1 flex flex-col overflow-hidden border bg-card rounded-none">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left relative text-sm">
                        <thead className="bg-muted text-xs uppercase text-muted-foreground font-bold tracking-wider sticky z-10 shadow-sm">
                            <tr>
                                <th className="p-4 pl-6 whitespace-nowrap bg-muted">Type</th>
                                <th className="p-4 whitespace-nowrap bg-muted">Hash</th>
                                <th className="p-4 whitespace-nowrap bg-muted">Amount</th>
                                <th className="p-4 whitespace-nowrap bg-muted">Date</th>
                                <th className="p-4 text-right pr-6 whitespace-nowrap bg-muted">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y text-foreground">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading transaction history...</td></tr>
                            ) : data.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No transactions found</td></tr>
                            ) : (
                                data.map((tx, i) => (
                                    <tr
                                        key={i}
                                        className="hover:bg-accent/50 transition-colors cursor-pointer group"
                                        onClick={() => setSelectedTx(tx)}
                                    >
                                        <td className="p-4 pl-6 flex items-center gap-3 whitespace-nowrap">
                                            <div className="p-2 rounded-lg bg-accent border shrink-0 group-hover:border-primary/50 transition-colors">
                                                {getIcon(tx.type)}
                                            </div>
                                            <span className="capitalize font-medium">{tx.type}</span>
                                        </td>
                                        <td className="p-4 font-mono text-xs text-muted-foreground max-w-[100px] md:max-w-[150px] truncate" title={tx.txHash}>
                                            {tx.txHash ? `${tx.txHash.substring(0, 6)}...${tx.txHash.substring(tx.txHash.length - 4)}` : '-'}
                                        </td>
                                        <td className="p-4 font-bold whitespace-nowrap">
                                            {tx.type === 'swap' && tx.metadata?.fromAmount !== undefined
                                                ? `${tx.metadata.fromAmount} AT → ${tx.metadata.toAmount} ATH`
                                                : `${tx.amount} ${tx.type === 'mining' || tx.type === 'mining_reward' ? 'AT' : 'ATH'}`}
                                        </td>
                                        <td className="p-4 text-muted-foreground whitespace-nowrap">
                                            {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="p-4 text-right pr-6 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded text-[10px] md:text-xs font-bold uppercase border inline-flex
                                        ${tx.status === 'completed' ? 'bg-background text-foreground' :
                                                    tx.status === 'pending' ? 'bg-muted text-muted-foreground' :
                                                        'bg-destructive/10 text-destructive border-destructive/20'}`}>
                                                {tx.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <AnimatePresence>
                {selectedTx && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/90 backdrop-blur-xl">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="w-full max-w-lg bg-card border border-border relative overflow-hidden shadow-2xl"
                        >
                            {/* Receipt Background Texture */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                            <div className="p-8 relative">
                                <button
                                    onClick={() => setSelectedTx(null)}
                                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-3 mb-8">
                                    <ShieldCheck className="w-6 h-6 text-foreground" />
                                    <div className="h-px flex-1 bg-border" />
                                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.4em]">Node-Auth-Receipt</span>
                                </div>

                                <div className="space-y-8">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <h3 className="text-2xl font-light text-foreground tracking-tighter uppercase">{selectedTx.status === 'completed' ? 'SUCCESSFUL' : selectedTx.status}</h3>
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Digital Asset Transfer</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-mono font-bold text-foreground tracking-tighter">
                                                {selectedTx.type === 'swap' && selectedTx.metadata?.fromAmount !== undefined
                                                    ? `${selectedTx.metadata.fromAmount} AT → ${selectedTx.metadata.toAmount} ATH`
                                                    : `${selectedTx.amount} ${selectedTx.type === 'mining' || selectedTx.type === 'mining_reward' ? 'AT' : 'ATH'}`}
                                            </p>
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Network Settled</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-6 text-sm font-mono pt-8 border-t border-border">
                                        <div>
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">TYPE</p>
                                            <p className="text-foreground text-xs uppercase">{selectedTx.type}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">SETTLEMENT</p>
                                            <p className="text-foreground text-xs">Internal ledger</p>
                                        </div>

                                        <div>
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">FROM_ADDR</p>
                                            <p className="text-foreground text-[10px] break-all opacity-80">{selectedTx.metadata?.sender?.value || (selectedTx.type === 'swap' ? 'Your internal AT account' : selectedTx.fromAddress || 'System reward')}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">RECIPIENT_ADDR</p>
                                            <p className="text-foreground text-[10px] break-all opacity-80">{selectedTx.metadata?.recipient?.value || selectedTx.toAddress || 'Your internal account'}</p>
                                        </div>

                                        <div>
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">NETWORK</p>
                                            <p className="text-foreground text-xs font-bold tracking-tight">AtherChain</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">PROTOCOL</p>
                                            <p className="text-foreground text-xs">Internal ledger</p>
                                        </div>

                                        <div>
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">FEE</p>
                                            <p className="text-foreground text-xs">{selectedTx.fee || '0'} ATH</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">DATE</p>
                                            <p className="text-foreground text-xs">{new Date(selectedTx.timestamp || selectedTx.date).toLocaleString()}</p>
                                        </div>

                                        <div className="col-span-2 border-t border-border/30 pt-4">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">TXN_HASH</p>
                                            <p className="text-foreground text-[10px] break-all opacity-60 leading-relaxed">{selectedTx.txHash}</p>
                                        </div>
                                    </div>

                                    <div className="pt-8 flex flex-col items-center gap-4">
                                        <div className="w-full h-8 flex items-center justify-between opacity-10">
                                            {[...Array(40)].map((_, i) => (
                                                <div key={i} className="w-0.5 h-full bg-white" />
                                            ))}
                                        </div>
                                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.5em]">Auth-Verification-Stamp</p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
