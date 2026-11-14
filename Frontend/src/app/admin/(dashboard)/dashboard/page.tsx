'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountryPieChart } from '@/components/admin/charts/CountryPieChart';
import { UserGrowthChart } from '@/components/admin/charts/UserGrowthChart';
import { Users, Pickaxe, RefreshCw, Zap, Activity, Network } from 'lucide-react';
import api from '@/lib/api';

export default function OverviewPage() {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchStats = async () => {
            const token = localStorage.getItem('admin_token');
            if (!token) {
                // Should be handled by layout, but just in case
                return;
            }
            try {
                const res = await api.get('/admin/stats', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats(res.data);
            } catch (error: any) {
                console.error(error);
                setError(error.message || 'Failed to fetch stats');
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    // Fallback defaults if API fails or returns null
    const swapData = stats?.swapTrend || [0, 0, 0, 0, 0];
    const userGrowthData = stats?.userGrowth || [];
    const countryData = stats?.countryDistribution || [];

    return (
        <div className="space-y-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-black uppercase tracking-widest text-foreground">Operational Overview</h1>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Network Statistics & Growth Matrix</p>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-none font-mono text-xs uppercase tracking-widest flex items-center gap-3">
                    <div className="w-2 h-2 bg-destructive animate-pulse" />
                    <span className="opacity-50 tracking-tighter">System error:</span> {error}
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { title: 'Total Users', value: stats?.totalUsers || 0, icon: Users, color: 'text-primary' },
                    { title: 'Active Miners', value: stats?.activeMiners || 0, icon: Pickaxe, color: 'text-foreground' },
                    { title: 'Total Mined', value: `${(stats?.totalMined || 0).toLocaleString()}`, suffix: 'AT', icon: Zap, color: 'text-yellow-500' },
                    { title: 'Swap Volume', value: `$${(stats?.swapVolume || 0).toLocaleString()}`, icon: RefreshCw, color: 'text-foreground' },
                ].map((item, i) => (
                    <div key={i} className="bg-card border border-border p-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-5 transition-transform group-hover:scale-110 duration-500">
                            <item.icon className="w-16 h-16 text-foreground" />
                        </div>
                        <div className="relative z-10 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 border border-border bg-secondary/50">
                                    <item.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                                </div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                                    {item.title}
                                </h3>
                            </div>
                            <div className="flex items-baseline gap-2">
                                <div className="text-2xl font-black tracking-tight text-foreground">
                                    {item.value}
                                </div>
                                {item.suffix && (
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.suffix}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* User Growth */}
                <div className="xl:col-span-2 bg-card border border-border p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                            <Activity className="w-3 h-3" /> Growth Trajectory
                        </h3>
                        <div className="h-px bg-border/20 flex-1 ml-6" />
                    </div>
                    <div className="h-[300px] w-full mt-4">
                        <UserGrowthChart data={userGrowthData} />
                    </div>
                </div>

                {/* Country Distribution */}
                <div className="bg-card border border-border p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                            <Network className="w-3 h-3" /> Geo-Distribution
                        </h3>
                        <div className="h-px bg-border/20 flex-1 ml-6" />
                    </div>
                    <div className="h-[300px] w-full mt-4">
                        <CountryPieChart data={countryData} />
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-10">
                {/* Recent Users */}
                <div className="bg-card border border-border overflow-hidden">
                    <div className="p-6 border-b border-border bg-secondary/10 flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                            <Users className="w-3 h-3" /> Inbound Node Registration
                        </h3>
                        <span className="text-[9px] font-mono text-muted-foreground/40 uppercase">Real-time Stream</span>
                    </div>
                    <div className="divide-y divide-border/50">
                        {!stats?.recentUsers || stats?.recentUsers?.length === 0 ? (
                            <div className="text-[10px] text-muted-foreground text-center py-20 font-mono uppercase tracking-[0.5em] opacity-30">Null Sector</div>
                        ) : (
                            stats?.recentUsers?.map((u: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-secondary/50 flex items-center justify-center text-[10px] font-black border border-border group-hover:border-foreground/30 transition-colors duration-500">
                                            {u.username.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold tracking-tight text-foreground">{u.username}</div>
                                            <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-[0.1em] opacity-60">Joined {new Date(u.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className={`text-[9px] font-black uppercase tracking-widest border px-3 py-1 rounded-none ${u.kyc_status === 'approved' ? 'border-foreground text-foreground bg-foreground/5' : 'border-border text-muted-foreground'}`}>
                                        {u.kyc_status?.toUpperCase() || 'UNVERIFIED'}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Recent Swaps */}
                <div className="bg-card border border-border overflow-hidden">
                    <div className="p-6 border-b border-border bg-secondary/10 flex items-center justify-between">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                            <RefreshCw className="w-3 h-3" /> Liquidity Swaps
                        </h3>
                        <span className="text-[9px] font-mono text-muted-foreground/40 uppercase">Ledger Sync</span>
                    </div>
                    <div className="divide-y divide-border/50">
                        {!stats?.recentSwaps || stats?.recentSwaps?.length === 0 ? (
                            <div className="text-[10px] text-muted-foreground text-center py-20 font-mono uppercase tracking-[0.5em] opacity-30">Null Feed</div>
                        ) : (
                            stats?.recentSwaps?.map((swap: any, i: number) => (
                                <div key={i} className="flex items-center justify-between p-5 hover:bg-secondary/30 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 bg-secondary/50 flex items-center justify-center text-[10px] font-black border border-border group-hover:border-foreground/30 transition-colors duration-500">
                                            <RefreshCw className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold tracking-tight text-foreground uppercase">
                                                {swap.amount} <span className="text-[10px] opacity-40">ATH</span>
                                            </div>
                                            <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-[0.1em] opacity-60">
                                                ID {swap._id.slice(-8).toUpperCase()} • {new Date(swap.createdAt).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={`text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 ${swap.status === 'success' || swap.status === 'completed' ? 'text-green-500' :
                                            swap.status === 'pending' ? 'text-yellow-500' : 'text-red-500'
                                            }`}>
                                            {swap.status}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
