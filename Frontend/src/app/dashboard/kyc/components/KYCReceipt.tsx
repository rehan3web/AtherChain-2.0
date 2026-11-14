'use client';

import { CheckCircle2, AlertCircle, Clock, ArrowRight, ShieldCheck, RefreshCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface KYCReceiptProps {
    status: 'pending' | 'approved' | 'rejected';
    data: any;
    onRetry?: () => void;
}

export function KYCReceipt({ status, data, onRetry }: KYCReceiptProps) {
    const isApproved = status === 'approved';
    const isRejected = status === 'rejected';
    const isPending = status === 'pending';

    const getStatusColor = () => {
        if (isApproved) return "text-green-500";
        if (isRejected) return "text-red-500";
        return "text-orange-500";
    };

    const getStatusIcon = () => {
        if (isApproved) return <CheckCircle2 className={`w-20 h-20 ${getStatusColor()}`} />;
        if (isRejected) return <AlertCircle className={`w-20 h-20 ${getStatusColor()}`} />;
        return <Clock className={`w-20 h-20 ${getStatusColor()}`} />;
    };

    const getStatusText = () => {
        if (isApproved) return "VERIFIED";
        if (isRejected) return "REJECTED";
        return "PENDING";
    };

    const getStatusDescription = () => {
        if (isApproved) return "Identity Verification Complete";
        if (isRejected) return "Identity Verification Failed";
        return "Verification In Progress";
    };

    return (
        <div className="w-full font-sans selection:bg-foreground selection:text-background flex flex-col items-center justify-center min-h-[60vh]">
            <div className="max-w-md w-full mx-auto text-center">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 15 }}
                    className="mb-8 flex justify-center"
                >
                    <div className="relative">
                        {getStatusIcon()}
                        <motion.div
                            animate={{ opacity: [0.2, 0.5, 0.2] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className={`absolute inset-0 bg-current blur-xl rounded-full ${getStatusColor()}`}
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <div className="flex flex-col items-center gap-2 mb-8">
                        <h2 className="text-2xl font-light tracking-tight text-foreground uppercase">{getStatusText()}</h2>
                        <p className="text-muted-foreground text-sm font-mono uppercase tracking-widest">
                            {getStatusDescription()}
                        </p>
                    </div>

                    <div className="bg-card border border-border p-6 mb-8 text-left w-full space-y-4 relative overflow-hidden">
                        {/* Receipt Background Texture */}
                        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/50">
                                <ShieldCheck className="w-5 h-5 text-foreground" />
                                <div className="h-px flex-1 bg-border/50" />
                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em]">KYC-Receipt</span>
                            </div>

                            <div className="grid grid-cols-2 gap-y-6 text-sm font-mono">
                                <div className="col-span-2">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">APPLICANT_NAME</p>
                                    <p className="text-foreground text-xs font-bold">{data?.full_name || 'N/A'}</p>
                                </div>

                                <div>
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">ID_TYPE</p>
                                    <p className="text-foreground text-xs">{data?.id_type || 'N/A'}</p>
                                </div>

                                <div className="text-right">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">ID_NUMBER</p>
                                    <p className="text-foreground text-xs">{data?.id_number || 'N/A'}</p>
                                </div>

                                <div>
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">COUNTRY</p>
                                    <p className="text-foreground text-xs">{data?.country || 'N/A'}</p>
                                </div>

                                <div className="text-right">
                                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">SUBMITTED_DATE</p>
                                    <p className="text-foreground text-xs">{data?.submittedAt ? new Date(data.submittedAt).toLocaleDateString() : new Date().toLocaleDateString()}</p>
                                </div>

                                {isRejected && (
                                    <div className="col-span-2 pt-4 border-t border-red-500/20">
                                        <p className="text-[9px] text-red-500/70 uppercase tracking-widest mb-1">REJECTION_REASON</p>
                                        <p className="text-red-500 text-xs leading-relaxed">{data?.rejectionReason || 'Document verification failed.'}</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 flex flex-col items-center gap-3">
                                <div className="w-full h-6 flex items-center justify-between opacity-10">
                                    {[...Array(30)].map((_, i) => (
                                        <div key={i} className="w-0.5 h-full bg-foreground" />
                                    ))}
                                </div>
                                <p className="text-[8px] font-mono text-muted-foreground uppercase tracking-[0.4em]">Official-Verification-Document</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 w-full">
                        {isRejected ? (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-red-600 text-white text-sm font-bold tracking-widest hover:bg-red-700 transition-all uppercase"
                            >
                                <RefreshCcw className="w-4 h-4" />
                                Retry Verification
                            </button>
                        ) : (
                            <Link href="/dashboard">
                                <button type="button" className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-foreground text-background text-sm font-bold tracking-widest hover:opacity-90 transition-all uppercase">
                                    <ArrowRight className="w-4 h-4" />
                                    Return to Dashboard
                                </button>
                            </Link>
                        )}

                        {isApproved && (
                            <div className="text-center">
                                <p className="text-xs text-muted-foreground mt-4">You have full access to all platform features.</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
