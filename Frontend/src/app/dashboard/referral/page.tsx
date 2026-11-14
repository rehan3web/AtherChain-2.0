'use client';

import { useState, useEffect } from 'react';
import { Copy, RefreshCw, LogOut, Terminal, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import api from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import { useAlert } from '@/providers/AlertProvider';
import { MetricCard } from '@/components/ui/MetricCard';
import { NetworkVisualization } from '@/components/ui/NetworkVisualization';
import { SatelliteLedger } from '@/components/ui/SatelliteLedger';
// Original used local simple state `copied`. I will reuse `copied` or adapt to toast if available. The user prompt shows `useToast` in reference.
// Let's check imports in reference: `import { useToast } from "@/hooks/use-toast";`.
// Front end path usually `components/ui/use-toast`.
// I'll try to stick to local `copied` state for simplicity unless I see `use-toast` is available.
// Actually, `frontend/src/app/dashboard/swap/page.tsx` previously imported `use-toast` but was commented out. 
// I'll stick to local state to avoid import errors, but style it nicely or just use the local state for button feedback.

export default function ReferralPage() {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const { showAlert } = useAlert();
    const [copied, setCopied] = useState(false);
    // const [hoveredNode, setHoveredNode] = useState<any>(null); // Unused in new UI since Viz handles it internally

    const fetchStats = async () => {
        try {
            const res = await api.get('/referral/stats');
            setStats(res.data);
        } catch (error: any) {
            console.error('Failed to fetch referral intelligence', error);
            const errorMessage = error.response?.data?.message || 'Failed to fetch referral stats';
            showAlert('danger', errorMessage);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 15000); // Poll every 15s
        return () => clearInterval(interval);
    }, []);

    const handleCopy = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopied(true);
                showAlert('success', 'Copied successfully');
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {
                showAlert('error', 'Copy failed');
            });
    };

    const isLoading = !stats;

    // Derived metrics
    const activeNodes = stats?.referrals?.filter((r: any) => r.kyc_status === 'approved').length || 0;
    const verificationRate = stats?.totalReferrals > 0
        ? Math.round((activeNodes / stats.totalReferrals) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-foreground selection:text-background">
            {/* Decorative scanline */}
            <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%]" />

            {/* Header */}
            <header className="border-b border-border/40 bg-background/50 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]" />
                            Network Expansion Protocol
                        </h1>
                        <span className="text-[10px] text-muted-foreground font-mono">ACTIVE SESSION // {user?.email || 'UNKNOWN_AGENT'}</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost" // 'tech' variant not standard shadcn, fallback to ghost or outline with styling
                            size="sm"
                            onClick={fetchStats}
                            className="hidden md:flex gap-2 text-xs font-mono border border-border hover:bg-secondary"
                        >
                            <RefreshCw className={`w-3 h-3 ${!stats ? 'animate-spin' : ''}`} />
                            {!stats ? "SYNCING..." : "SYNC STATE"}
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => logout()}
                            className="text-xs font-mono text-muted-foreground hover:text-foreground"
                        >
                            <LogOut className="w-3 h-3 mr-2" />
                            DISCONNECT
                        </Button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-10 space-y-12">

                {/* Intro Section */}
                <section className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-border pb-10">
                    <div className="space-y-2 max-w-2xl">
                        <h2 className="text-3xl md:text-4xl font-light tracking-tighter">Propagate your influence.</h2>
                        <h2 className="text-3xl md:text-4xl font-light tracking-tighter text-muted-foreground">Extract L1 protocol incentives.</h2>
                    </div>

                    <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Agent Identity Code</span>
                        <div className="flex items-center gap-2 bg-secondary p-1 pl-4 rounded-none border border-border hover:border-foreground/30 transition-colors group">
                            <code className="text-xl font-mono tracking-widest text-foreground">{stats?.referralCode || '...'}</code>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-foreground hover:text-background transition-colors rounded-none"
                                onClick={() => handleCopy(stats?.referralCode)}
                            >
                                <Copy className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Metrics Grid */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-mono uppercase text-muted-foreground tracking-widest">Protocol Metrics</h3>
                        <div className="h-px bg-border/40 flex-1 ml-4" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <MetricCard
                            title="Propagated Nodes"
                        >
                            <div className="text-3xl font-mono font-medium tracking-tighter text-foreground">
                                {stats?.totalReferrals || 0}
                            </div>
                        </MetricCard>

                        <MetricCard
                            title="Active Direct Connections"
                        >
                            <div className="text-3xl font-mono font-medium tracking-tighter text-foreground">
                                {activeNodes}
                            </div>
                        </MetricCard>

                        <MetricCard
                            title="Extracted Rewards"
                            className="border-primary/20 bg-secondary"
                        >
                            <div className="text-3xl font-mono font-medium tracking-tighter text-foreground">
                                {stats?.totalEarned ? parseFloat(stats.totalEarned).toLocaleString() : '0'} <span className="text-xs text-muted-foreground">AT</span>
                            </div>
                        </MetricCard>

                        <MetricCard
                            title="Total Neural Incentives"
                        >
                            <div className="text-3xl font-mono font-medium tracking-tighter text-foreground">
                                {stats?.totalEarned ? parseFloat(stats.totalEarned).toLocaleString() : '0'} <span className="text-xs text-muted-foreground">AT</span>
                            </div>
                        </MetricCard>

                        <MetricCard
                            title="Conversion Velocity"
                        >
                            <div className="text-3xl font-mono font-medium tracking-tighter text-foreground">
                                100%
                            </div>
                        </MetricCard>

                        <MetricCard
                            title="L1 Verification Rate"
                        >
                            <div className="text-3xl font-mono font-medium tracking-tighter text-foreground">
                                {verificationRate}%
                            </div>
                        </MetricCard>
                    </div>
                </section>

                {/* Network & Link Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: Visualization */}
                    <section className="lg:col-span-2 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-mono uppercase text-muted-foreground tracking-widest">Network Topology</h3>
                            <div className="h-px bg-border/40 flex-1 ml-4" />
                        </div>
                        {/* Adapt props: data expects { referrals: [] } which matches stats structure if we treat stats as data */}
                        <NetworkVisualization data={stats} isLoading={isLoading} />
                    </section>

                    {/* Right: Actions & Yields */}
                    <section className="space-y-8">
                        {/* Propagation Link */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-mono uppercase text-muted-foreground tracking-widest">Propagation Vector</h3>
                            <div className="p-6 border border-border/40 bg-card/20 space-y-4">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Share your unique vector to expand the network. Each valid node activation grants protocol rewards.
                                </p>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-muted border border-border px-3 py-2 text-xs font-mono text-muted-foreground truncate flex items-center">
                                        {stats?.referralLink || 'Unavailable'}
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="rounded-none border-border hover:bg-foreground hover:text-background"
                                        onClick={() => handleCopy(stats?.referralLink)}
                                    >
                                        {copied ? "COPIED" : "COPY"}
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Protocol Yields */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-mono uppercase text-muted-foreground tracking-widest">Protocol Yields</h3>
                            <div className="space-y-2">
                                <div className="group p-4 border border-border/40 bg-card/10 hover:bg-secondary/40 transition-colors cursor-default">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-sm font-medium text-foreground">Registration Reward</span>
                                        <Badge variant="outline" className="rounded-none border-green-500/50 text-green-500 bg-green-500/10 font-mono text-[10px]">ACTIVE</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono">
                                        {stats?.config?.unverifiedReward || 10} AT / INSTANT
                                    </p>
                                </div>

                                <div className="group p-4 border border-border/40 bg-card/10 hover:bg-secondary/40 transition-colors cursor-default">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-sm font-medium text-foreground">KYC Verification</span>
                                        <Badge variant="outline" className="rounded-none border-blue-500/50 text-blue-500 bg-blue-500/10 font-mono text-[10px]">BOOSTED</Badge>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono">
                                        {stats?.config?.verifiedReward || 50} AT / UNLOCKED
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                {/* Satellite Ledger */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-mono uppercase text-muted-foreground tracking-widest">Satellite Ledger</h3>
                        <div className="h-px bg-border/40 flex-1 ml-4" />
                    </div>
                    {/* Adapt props: referrals prop expects array. stats.referrals is array. */}
                    <SatelliteLedger
                        referrals={stats?.referrals}
                        isLoading={isLoading}
                        unverifiedReward={stats?.config?.unverifiedReward}
                        verifiedReward={stats?.config?.verifiedReward}
                    />
                </section>

            </main>
        </div>
    );
}
