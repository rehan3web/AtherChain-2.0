'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { MaintenanceCountdown } from '@/components/ui/MaintenanceCountdown';
import { Hammer, ShieldAlert, Cpu, Network, Loader2 } from 'lucide-react';
import { Suspense } from 'react';

function MaintenanceContent() {
    const searchParams = useSearchParams();
    const until = searchParams.get('until');

    return (
        <div className="z-10 w-full max-w-3xl space-y-16 text-center">
            <div className="space-y-6">
                <div className="flex justify-center mb-8 relative">
                    <div className="p-5 border border-border bg-card relative z-10">
                        <Hammer className="w-12 h-12 text-foreground animate-bounce" />
                    </div>
                    <div className="absolute inset-0 bg-foreground/10 blur-2xl rounded-full scale-150 opacity-50" />
                </div>

                <div className="space-y-2">
                    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/40">
                        System Upgrade
                    </h1>
                    <p className="text-xs md:text-sm font-mono text-muted-foreground uppercase tracking-[0.4em] font-bold">
                        Nodes are currently undergoing maintenance
                    </p>
                </div>
            </div>

            <div className="space-y-10 py-10 border-y border-border/40 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-background px-4">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest bg-secondary px-3 py-1 border border-border">
                        Estimated Recovery
                    </span>
                </div>

                <MaintenanceCountdown untilDate={until} />

                {until && new Date() >= new Date(until) && (
                    <div className="pt-4 flex justify-center">
                        <button
                            onClick={() => window.location.href = '/dashboard'}
                            className="px-10 py-4 bg-foreground text-background font-black uppercase tracking-widest text-xs hover:opacity-90 transition-opacity"
                        >
                            Re-Enter Protocol
                        </button>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10">
                <StatusFeature
                    icon={<ShieldAlert className="w-5 h-5" />}
                    title="Secure"
                    desc="Funds & data safely stored in cold nodes"
                />
                <StatusFeature
                    icon={<Cpu className="w-5 h-5" />}
                    title="Optimization"
                    desc="Upgrading protocol for higher throughput"
                />
                <StatusFeature
                    icon={<Network className="w-5 h-5" />}
                    title="Network"
                    desc="Synchronizing global state across clusters"
                />
            </div>

            <footer className="pt-16">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest opacity-40">
                    Protocol v2.4.0-Maintenance | Ather Network Core
                </p>
            </footer>
        </div>
    );
}

export default function MaintenancePage() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(var(--foreground-rgb),0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(var(--foreground-rgb),0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

            {/* Animated Glows */}
            <div className="absolute top-1/4 -left-20 w-96 h-96 bg-foreground/5 rounded-full blur-[120px] animate-pulse" />
            <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-foreground/5 rounded-full blur-[120px] animate-pulse delay-1000" />

            <Suspense fallback={
                <div className="flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="font-mono text-[10px] uppercase tracking-widest">Entering Maintenance Cluster...</p>
                </div>
            }>
                <MaintenanceContent />
            </Suspense>
        </div>
    );
}

function StatusFeature({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="p-6 border border-border/40 bg-card/10 backdrop-blur-sm space-y-3 text-left">
            <div className="text-foreground/60">{icon}</div>
            <h3 className="text-xs font-black uppercase tracking-widest text-foreground">{title}</h3>
            <p className="text-[10px] text-muted-foreground leading-relaxed uppercase tracking-wider font-medium">{desc}</p>
        </div>
    );
}
