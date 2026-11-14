'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldAlert, ArrowRight, HelpCircle, LogOut } from 'lucide-react';
import { useAuth } from '@/providers/AuthProvider';

export default function BlockedPage() {
    const { logout } = useAuth();

    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 font-sans selection:bg-white selection:text-black">
            {/* Technical Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'border-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl w-full bg-card border border-border p-12 relative overflow-hidden"
            >
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t border-l border-white/20" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r border-white/20" />

                <div className="flex flex-col items-center text-center space-y-8">
                    <div className="w-20 h-20 bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                        <ShieldAlert size={40} className="text-white" />
                    </div>

                    <div className="space-y-4">
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.5em]">SYSTEM_SECURITY_ALERT</span>
                        <h1 className="text-4xl font-light tracking-tighter uppercase">Account Suspended</h1>
                        <div className="h-px w-24 bg-white/20 mx-auto" />
                    </div>

                    <p className="text-sm font-mono text-muted-foreground uppercase leading-loose tracking-widest bg-white/5 p-8 border border-white/10">
                        Your access to the AtherChain network has been restricted. This may be due to a security violation, outstanding verification requirements, or administrative lockdown.
                    </p>

                    <div className="grid grid-cols-1 gap-4 w-full pt-8">
                        <Link href="/help">
                            <button className="w-full h-16 bg-white text-black font-mono font-bold text-[10px] uppercase tracking-[0.4em] hover:opacity-90 transition-all flex items-center justify-center gap-4">
                                CONTACT_SUPPORT <HelpCircle size={18} />
                            </button>
                        </Link>

                        <button
                            onClick={logout}
                            className="w-full h-16 border border-white/10 bg-transparent font-mono font-bold text-[10px] uppercase tracking-[0.4em] hover:bg-white/5 transition-all flex items-center justify-center gap-4"
                        >
                            TERMINATE_SESSION <LogOut size={18} />
                        </button>
                    </div>
                </div>

                {/* Technical Meta Footer */}
                <div className="mt-12 pt-8 border-t border-white/10 flex justify-between items-center text-[8px] font-mono text-muted-foreground uppercase tracking-widest">
                    <span>ERR_CODE: USER_BLOCKED_LOCKDOWN</span>
                    <span>TS: {new Date().toISOString().split('T')[1].split('.')[0]}</span>
                </div>
            </motion.div>
        </div>
    );
}
