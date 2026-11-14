
'use client';

import { motion } from 'framer-motion';
import { X, ShieldCheck, Info, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ClaimModalProps {
    onClose: () => void;
    onConfirm: () => void;
    isLoading: boolean;
}

export default function ClaimModal({ onClose, onConfirm, isLoading }: ClaimModalProps) {
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-card border border-border relative overflow-hidden shadow-2xl"
            >
                {/* Texture */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '16px 16px' }} />

                <div className="p-8 relative">
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    <div className="flex items-center gap-3 mb-8">
                        <ShieldCheck className="w-6 h-6 text-foreground" />
                        <div className="h-px flex-1 bg-border" />
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.4em]">Auth-Receipt</span>
                    </div>

                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-2xl font-light text-foreground tracking-tighter uppercase mb-2">Claim Swap Fee</h3>
                            <div className="bg-foreground/[0.03] p-6 border border-border mt-4 relative group transition-all duration-500 hover:border-foreground/30">
                                <div className="absolute top-0 right-0 p-2 opacity-10">
                                    <ShieldCheck className="w-8 h-8 rotate-12" />
                                </div>
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mb-2">Claim Amount</p>
                                <div className="flex items-center justify-center gap-2">
                                    <p className="text-4xl font-mono font-bold text-foreground tracking-tight">0.1</p>
                                    <p className="text-sm font-bold text-foreground/50 self-end pb-1 tracking-widest">ATH</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 py-2">
                            <div className="flex gap-3">
                                <div className="size-5 rounded-full bg-foreground/[0.05] flex items-center justify-center shrink-0">
                                    <Info className="w-3 h-3 text-foreground/60" />
                                </div>
                                <p className="text-[10px] font-mono text-muted-foreground leading-relaxed uppercase tracking-wider">
                                    This fee is used for Swap Fee. This is a one-time claim.
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <div className="size-5 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                                    <AlertCircle className="w-3 h-3 text-red-500/80" />
                                </div>
                                <p className="text-[10px] font-mono text-red-500/60 leading-relaxed uppercase tracking-wider italic">
                                    If used for another purpose, you will not be able to Swap again.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                disabled={isLoading}
                                className="flex-1 rounded-none border-border hover:bg-secondary text-[10px] font-bold uppercase tracking-widest h-12"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={onConfirm}
                                disabled={isLoading}
                                className="flex-1 rounded-none bg-foreground text-background hover:opacity-90 text-[10px] font-bold uppercase tracking-widest h-12 shadow-xl relative"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    "Claim"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
