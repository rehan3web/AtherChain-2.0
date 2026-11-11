'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, ShieldCheck, CreditCard, ArrowRight, Check,
    AlertCircle, Loader2, Wallet, FileText, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import api from '@/lib/api';

interface DialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    balance: string;
    fee: number;
}

export const ActivationPaymentModal: React.FC<DialogProps> = ({
    isOpen, onClose, onSuccess, balance, fee
}) => {
    const [step, setStep] = useState(1);
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [receipt, setReceipt] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePay = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.post('/user/kyc/activate');
            setReceipt(res.data);
            setStep(4);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Payment failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            />

            {/* Modal Content */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden z-10"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                            <ShieldCheck size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Node Activation</h2>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-mono">Step {step} of 4</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-4">
                                    <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-3">
                                        <div className="flex items-center gap-2 text-blue-500 font-bold text-sm">
                                            <AlertCircle size={18} />
                                            <span>Important Note</span>
                                        </div>
                                        <ul className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                                            <li className="flex gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                                The fee is used to activate your mining node.
                                            </li>
                                            <li className="flex gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                                This ATH verifies your node for activation.
                                            </li>
                                            <li className="flex gap-2">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                                If you pay, your node server will be activated for lifetime.
                                            </li>
                                        </ul>
                                    </div>
                                    <p className="text-sm text-muted-foreground text-center italic">
                                        One-time payment to verify your mining server.
                                    </p>
                                </div>
                                <Button className="w-full h-14 text-lg" onClick={() => setStep(2)}>
                                    Next <ArrowRight className="ml-2" size={20} />
                                </Button>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="space-y-6">
                                    <div className="flex items-start gap-4 p-4 border border-border rounded-xl bg-muted/10">
                                        <FileText className="text-muted-foreground shrink-0" size={24} />
                                        <div className="space-y-1">
                                            <h3 className="font-bold">Service Agreement</h3>
                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                By proceeding, you agree to pay the activation fee of {fee} ATH. This payment is non-refundable
                                                and grants lifetime activation status to your mining node on the Ather Network.
                                            </p>
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-3 p-4 border border-border rounded-xl cursor-pointer hover:bg-muted/30 transition-colors group">
                                        <div className={cn(
                                            "w-6 h-6 rounded border-2 flex items-center justify-center transition-all",
                                            agreed ? "bg-purple-600 border-purple-600" : "border-muted-foreground/30 group-hover:border-purple-500"
                                        )}>
                                            {agreed && <Check size={16} className="text-white" />}
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="hidden"
                                            checked={agreed}
                                            onChange={(e) => setAgreed(e.target.checked)}
                                        />
                                        <span className="text-sm font-medium">I Agree to the activation terms</span>
                                    </label>
                                </div>
                                <div className="flex gap-4">
                                    <Button variant="outline" className="flex-1 h-14" onClick={() => setStep(1)}>Back</Button>
                                    <Button className="flex-[2] h-14 text-lg" disabled={!agreed} onClick={() => setStep(3)}>Next</Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-6"
                            >
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2 p-6 border border-border rounded-2xl bg-muted/20 flex flex-col items-center justify-center text-center space-y-2">
                                        <span className="text-xs font-mono uppercase text-muted-foreground tracking-widest">Amount to Pay</span>
                                        <span className="text-4xl font-black text-foreground font-mono">{fee} ATH</span>
                                    </div>
                                    <div className="p-4 border border-border rounded-xl bg-card">
                                        <span className="text-[10px] uppercase text-muted-foreground font-bold font-mono">Payment Status</span>
                                        <p className="font-bold flex items-center gap-2 mt-1">
                                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                            Unpaid
                                        </p>
                                    </div>
                                    <div className="p-4 border border-border rounded-xl bg-card">
                                        <span className="text-[10px] uppercase text-muted-foreground font-bold font-mono">Wallet Balance</span>
                                        <p className="font-bold font-mono mt-1 text-purple-500">{balance} ATH</p>
                                    </div>
                                </div>

                                {error && (
                                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex gap-3 text-red-500 text-sm">
                                        <AlertCircle size={18} className="shrink-0 mt-0.5" />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="flex gap-4">
                                    <Button variant="outline" className="flex-1 h-14" onClick={() => setStep(2)}>Back</Button>
                                    <Button
                                        className="flex-[2] h-14 text-lg bg-foreground text-background"
                                        disabled={loading || parseFloat(balance) < fee}
                                        onClick={handlePay}
                                    >
                                        {loading ? <Loader2 className="animate-spin mr-2" /> : 'Pay'}
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && receipt && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-6"
                            >
                                <div className="flex flex-col items-center text-center space-y-4">
                                    <div className="w-16 h-16 rounded-full bg-foreground/5 flex items-center justify-center relative">
                                        <CheckCircle2 size={40} className="text-foreground" />
                                        <motion.div
                                            animate={{ opacity: [0.2, 0.5, 0.2] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                            className="absolute inset-0 bg-foreground/10 blur-xl rounded-full"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-light tracking-tighter uppercase">Activation Success</h3>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">Node Protocol Settled</p>
                                    </div>
                                </div>

                                <div className="space-y-6 pt-4 border-t border-border/50">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Status</p>
                                            <div className="text-sm font-mono text-foreground flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-foreground rounded-full animate-pulse" />
                                                FINALIZED
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">Amount</p>
                                            <p className="text-2xl font-mono font-bold text-foreground tracking-tighter">{receipt.amount} ATH</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-y-4 pt-6 border-t border-border/20">
                                        <div>
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Network</p>
                                            <p className="text-foreground text-xs font-mono text-purple-400">Ather Chain</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Date</p>
                                            <p className="text-foreground text-xs font-mono">{new Date(receipt.timestamp).toLocaleDateString()}</p>
                                        </div>
                                        <div className="col-span-2 border-t border-border/20 pt-4">
                                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Transaction Hash</p>
                                            <p className="text-foreground text-[10px] font-mono break-all opacity-60">{receipt.txHash}</p>
                                        </div>
                                    </div>

                                    <div className="pt-6 flex flex-col items-center gap-3">
                                        <div className="w-full h-8 flex items-center justify-between opacity-5">
                                            {[...Array(30)].map((_, i) => (
                                                <div key={i} className="w-0.5 h-full bg-foreground" />
                                            ))}
                                        </div>
                                        <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-[0.4em]">Auth-Verification-Stamp</p>
                                    </div>
                                </div>

                                <Button className="w-full h-14 text-lg bg-foreground text-background hover:bg-foreground/90 mt-4 rounded-none" onClick={onSuccess}>
                                    Confirm & Continue
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
};
