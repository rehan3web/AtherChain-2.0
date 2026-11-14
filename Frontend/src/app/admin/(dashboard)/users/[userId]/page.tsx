'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit2, Shield, Pickaxe, Key, UserMinus, LogOut, ChevronRight, Zap, RefreshCw, BarChart3, Users, Network, Activity, ShieldCheck, Fingerprint, User, Lock, ArrowLeft, Terminal, ArrowUpRight, ArrowDownLeft, X, Wallet as WalletIcon, Coins, Copy, Search, Mail, AtSign, Database, Loader2 } from 'lucide-react';
import { EditUserModal, ConfirmModal, ResetPasswordModal } from '@/components/admin/UserModals';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NetworkVisualization } from '@/components/ui/NetworkVisualization';
import { SatelliteLedger } from '@/components/ui/SatelliteLedger';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import { useAlert } from '@/providers/AlertProvider';

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
    const { userId } = use(params);
    const router = useRouter();
    const { showAlert } = useAlert();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    // Balance Actions
    const [atAmount, setAtAmount] = useState('');
    const [athAmount, setAthAmount] = useState('');

    // Block Actions
    const [blockReason, setBlockReason] = useState('');

    const [referralPage, setReferralPage] = useState(1);
    const referralsPerPage = 5;

    // Action Modals State
    const [modal, setModal] = useState<'edit' | 'delete' | 'logout' | 'reset' | 'block' | 'recreate' | null>(null);

    // Transactions State
    const [transactions, setTransactions] = useState<any[]>([]);
    const [txLoading, setTxLoading] = useState(false);
    const [txPage, setTxPage] = useState(1);
    const [txTotalPages, setTxTotalPages] = useState(1);
    const [txSearch, setTxSearch] = useState('');
    const [txType, setTxType] = useState('all');
    const [selectedTx, setSelectedTx] = useState<any>(null);

    // Wallet Management State
    const [isRecreating, setIsRecreating] = useState(false);
    const [adminSendModal, setAdminSendModal] = useState(false);
    const [adminSendStep, setAdminSendStep] = useState(1);
    const [adminSendAsset, setAdminSendAsset] = useState<'ATH' | 'WATH'>('ATH');
    const [adminSendType, setAdminSendType] = useState<'email' | 'username' | 'address'>('email');
    const [adminSendTarget, setAdminSendTarget] = useState('');
    const [adminSendAmount, setAdminSendAmount] = useState('');
    const [adminSendTx, setAdminSendTx] = useState<any>(null);
    const [isAdminSending, setIsAdminSending] = useState(false);
    const [adminSendGas, setAdminSendGas] = useState<{ fee: string, to: string } | null>(null);
    const [isEstimatingGas, setIsEstimatingGas] = useState(false);
    const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);

    const fetchTransactions = async () => {
        setTxLoading(true);
        const token = localStorage.getItem('admin_token');
        try {
            const res = await api.get(`/admin/users/${userId}/transactions`, {
                params: { page: txPage, limit: 6, search: txSearch, type: txType },
                headers: { Authorization: `Bearer ${token}` }
            });
            setTransactions(res.data.data);
            setTxTotalPages(res.data.meta.totalPages);
        } catch (error) {
            console.error(error);
        } finally {
            setTxLoading(false);
        }
    };

    const fetchDetails = async () => {
        const token = localStorage.getItem('admin_token');
        try {
            const res = await api.get(`/admin/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
            if (res.data.user?.block_reason) setBlockReason(res.data.user.block_reason);
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Error fetching user');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [userId]);

    useEffect(() => {
        fetchTransactions();
    }, [userId, txPage, txSearch, txType]);

    const handleAction = async (action: string, field?: string, value?: any, reason?: string, payload?: any) => {
        const token = localStorage.getItem('admin_token');
        try {
            if (action === 'status') {
                const body: any = { [field!]: value };
                if (reason) body.block_reason = reason;

                await api.patch(`/admin/users/${userId}`, body, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            } else if (action === 'logout') {
                await api.post(`/admin/users/${userId}/logout`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setModal(null);
            } else if (action === 'delete') {
                await api.delete(`/admin/users/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                router.push('/admin/users');
                return;
            }
            fetchDetails();
            setModal(null);
            if (action !== 'status') {
                showAlert('success', 'Operation Success');
            }
        } catch (e: any) {
            showAlert('danger', e.response?.data?.message || 'Action failed');
        }
    };

    const handleBalanceUpdate = async (type: 'AT' | 'ATH', action: 'add' | 'deduct', amount: string) => {
        const token = localStorage.getItem('admin_token');
        if (!amount || isNaN(parseFloat(amount))) return showAlert('warning', 'Invalid amount');
        setIsUpdatingBalance(true);
        try {
            await api.post(`/admin/users/${userId}/balance`,
                { type, action, amount: parseFloat(amount) },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAtAmount('');
            setAthAmount('');
            await fetchDetails();
            showAlert('success', 'Sequence Complete: Balance Synchronized on Blockchain');
        } catch (e: any) {
            showAlert('danger', e.response?.data?.message || 'Sync failed');
        } finally {
            setIsUpdatingBalance(false);
        }
    };

    const handleRecreateWallet = async () => {
        setIsRecreating(true);
        const token = localStorage.getItem('admin_token');
        try {
            const res = await api.post(`/admin/users/${userId}/wallet/recreate`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchDetails();
            showAlert('success', `Wallet Recreated: ${res.data.address}`);
            setModal(null);
        } catch (e: any) {
            showAlert('danger', e.response?.data?.message || 'Recreation failed');
        } finally {
            setIsRecreating(false);
        }
    };

    const fetchAdminSendGas = async () => {
        if (!adminSendAmount || parseFloat(adminSendAmount) <= 0) return;
        setIsEstimatingGas(true);
        const token = localStorage.getItem('admin_token');
        try {
            const res = await api.post(`/admin/users/${userId}/wallet/estimate-gas`, {
                recipient: adminSendTarget,
                amount: adminSendAmount,
                type: adminSendType,
                asset: adminSendAsset
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setAdminSendGas({ fee: res.data.estimatedFee, to: res.data.toAddress });
        } catch (e: any) {
            console.error(e);
            showAlert('danger', e.response?.data?.message || 'Gas estimation failed');
        } finally {
            setIsEstimatingGas(false);
        }
    };

    const handleAdminSend = async () => {
        setIsAdminSending(true);
        const token = localStorage.getItem('admin_token');
        try {
            // 1. Initiate Transaction
            const res = await api.post(`/admin/users/${userId}/wallet/send`, {
                recipient: adminSendTarget,
                amount: adminSendAmount,
                type: adminSendType,
                asset: adminSendAsset
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const txHash = res.data.txHash;
            setAdminSendTx({ ...res.data, status: 'indexing' });

            // Since the backend now uses tx.wait(), the response here ONLY comes after confirmation.
            // We just need to update the state.
            setAdminSendTx(res.data);
            showAlert('success', 'Assets distributed successfully');
            setAdminSendStep(3); // Result step
            fetchTransactions();
            fetchDetails();
        } catch (e: any) {
            showAlert('danger', e.response?.data?.message || 'Distribution failed');
        } finally {
            setIsAdminSending(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-primary font-mono text-xl animate-pulse tracking-[0.5em]">Loading...</div>
        </div>
    );

    if (!data) return <div className="p-20 text-center text-destructive font-mono uppercase tracking-widest">User not found</div>;

    const { user, referrals, stats } = data;

    return (
        <div className="space-y-8 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.back()}
                        className="p-2 border border-border bg-secondary hover:bg-foreground hover:text-background transition-colors rounded-none"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h1 className="text-2xl font-black uppercase tracking-widest text-foreground">User Profile</h1>
                </div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest pl-12">User Account & Details</p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <MetricCard title="Basic Info" icon={<User className="w-4 h-4" />}>
                    <div className="text-xl font-bold truncate">{user.username}</div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">{user.email}</div>
                    <div className="text-[9px] text-primary/50 font-mono truncate mt-1">ID: {user.id}</div>
                </MetricCard>

                <MetricCard title="Status" icon={<ShieldCheck className="w-4 h-4" />}>
                    <div className={cn("text-xl font-bold uppercase", user.is_blocked ? "text-red-500" : "text-green-500")}>
                        {user.is_blocked ? 'Blocked' : 'Active'}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">Account: {user.is_blocked ? 'Locked' : 'Unlocked'}</p>
                </MetricCard>

                <MetricCard title="Joined Date" icon={<Zap className="w-4 h-4" />}>
                    <div className="text-xl font-bold">
                        {Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))}D
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">EST. {new Date(user.created_at).toLocaleDateString()}</p>
                </MetricCard>

                <MetricCard title="Verification" icon={<Fingerprint className="w-4 h-4" />}>
                    <div className="text-xl font-bold uppercase">{user.kyc_status || 'Level 0'}</div>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">KYC Status</p>
                </MetricCard>

                <MetricCard title="Referrals" icon={<Users className="w-4 h-4" />}>
                    <div className="text-xl font-bold">{stats.totalReferrals}</div>
                    <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-tighter">Total Network</p>
                </MetricCard>
            </div>

            {/* Content Tabs */}
            <Tabs defaultValue="manage" className="space-y-6">
                <TabsList className="bg-secondary/30 p-1 border border-border w-full h-auto min-h-12 lg:w-fit grid grid-cols-1 sm:grid-cols-4 gap-1 rounded-none">
                    <TabsTrigger value="manage" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-none font-bold uppercase tracking-widest text-[10px] px-4 sm:px-8 py-3">Overview</TabsTrigger>
                    <TabsTrigger value="referral" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-none font-bold uppercase tracking-widest text-[10px] px-4 sm:px-8 py-3 whitespace-nowrap">Referrals</TabsTrigger>
                    <TabsTrigger value="wallet" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-none font-bold uppercase tracking-widest text-[10px] px-4 sm:px-8 py-3 whitespace-nowrap">Wallet</TabsTrigger>
                    <TabsTrigger value="transactions" className="data-[state=active]:bg-foreground data-[state=active]:text-background rounded-none font-bold uppercase tracking-widest text-[10px] px-4 sm:px-8 py-3 whitespace-nowrap">Transactions</TabsTrigger>
                </TabsList>

                <TabsContent value="manage" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div className="grid gap-8 lg:grid-cols-2">
                        {/* Asset Management */}
                        <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                                <BarChart3 className="w-16 md:w-24 h-16 md:h-24 text-foreground" />
                            </div>

                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 border border-border bg-secondary">
                                        <BarChart3 className="w-5 h-5 text-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold uppercase tracking-widest">User Balances</h2>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">Update Funds</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* AT Balance */}
                                    <div className="p-6 bg-secondary/30 border border-border space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">AT Balance</p>
                                                <p className="text-3xl font-black tracking-tighter text-foreground">{parseFloat(user.at_balance || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full">
                                            <Input
                                                placeholder="0.00"
                                                className="flex-1 h-12 border-border bg-background font-mono text-lg rounded-none ring-0 focus-visible:ring-0 focus-visible:border-foreground disabled:opacity-50"
                                                value={atAmount}
                                                onChange={e => setAtAmount(e.target.value)}
                                                type="number"
                                                disabled={isUpdatingBalance}
                                            />
                                            <Button
                                                variant="outline"
                                                className="h-12 w-14 sm:w-16 border-border hover:bg-foreground hover:text-background transition-colors rounded-none font-bold text-xl shrink-0 disabled:opacity-50"
                                                onClick={() => handleBalanceUpdate('AT', 'add', atAmount)}
                                                disabled={isUpdatingBalance}
                                            >
                                                {isUpdatingBalance ? <Loader2 className="w-4 h-4 animate-spin" /> : '+'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="h-12 w-14 sm:w-16 border-border hover:bg-foreground hover:text-background transition-colors rounded-none font-bold text-xl shrink-0 disabled:opacity-50"
                                                onClick={() => handleBalanceUpdate('AT', 'deduct', atAmount)}
                                                disabled={isUpdatingBalance}
                                            >
                                                {isUpdatingBalance ? <Loader2 className="w-4 h-4 animate-spin" /> : '-'}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* ATH Balance */}
                                    <div className="p-6 bg-secondary/30 border border-border space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-1">
                                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">ATH Balance</p>
                                                <p className="text-3xl font-black tracking-tighter text-foreground">{parseFloat(user.balance_ath || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 w-full">
                                            <Input
                                                placeholder="0.00"
                                                className="flex-1 h-12 border-border bg-background font-mono text-lg rounded-none ring-0 focus-visible:ring-0 focus-visible:border-foreground disabled:opacity-50"
                                                value={athAmount}
                                                onChange={e => setAthAmount(e.target.value)}
                                                type="number"
                                                disabled={isUpdatingBalance}
                                            />
                                            <Button
                                                variant="outline"
                                                className="h-12 w-14 sm:w-16 border-border hover:bg-foreground hover:text-background transition-colors rounded-none font-bold text-xl shrink-0 disabled:opacity-50"
                                                onClick={() => handleBalanceUpdate('ATH', 'add', athAmount)}
                                                disabled={isUpdatingBalance}
                                            >
                                                {isUpdatingBalance ? <Loader2 className="w-4 h-4 animate-spin" /> : '+'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="h-12 w-14 sm:w-16 border-border hover:bg-foreground hover:text-background transition-colors rounded-none font-bold text-xl shrink-0 disabled:opacity-50"
                                                onClick={() => handleBalanceUpdate('ATH', 'deduct', athAmount)}
                                                disabled={isUpdatingBalance}
                                            >
                                                {isUpdatingBalance ? <Loader2 className="w-4 h-4 animate-spin" /> : '-'}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security & Access Controls */}
                        <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                                <Shield className="w-16 md:w-24 h-16 md:h-24 text-foreground" />
                            </div>

                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 border border-border bg-secondary">
                                        <Shield className="w-5 h-5 text-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold uppercase tracking-widest">Permissions</h2>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">Manage Status</p>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* KYC Status Toggle */}
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">KYC Status</label>
                                        <div className="grid grid-cols-3 gap-1 p-1 bg-secondary/30 border border-border">
                                            {['approved', 'rejected', 'unverified'].map((status) => (
                                                <Button
                                                    key={status}
                                                    variant="ghost"
                                                    className={cn(
                                                        "h-10 font-bold uppercase text-[10px] tracking-widest transition-all rounded-none w-full",
                                                        user.kyc_status === status
                                                            ? status === 'approved' ? "bg-foreground text-background" : status === 'rejected' ? "bg-red-600 text-white" : "bg-neutral-600 text-white"
                                                            : "text-muted-foreground hover:text-foreground"
                                                    )}
                                                    onClick={() => user.kyc_status !== status && handleAction('status', 'kyc_status', status)}
                                                >
                                                    {status}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Mining Transfer Swap with StatusToggle */}
                                    <div className="grid grid-cols-1 gap-6">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-secondary/20 border border-border">
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Mining Protocol</span>
                                            <StatusToggle
                                                active={!user.mining_paused}
                                                onToggle={(val) => handleAction('status', 'mining_paused', !val)}
                                            />
                                        </div>

                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-secondary/20 border border-border">
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Swap Interface</span>
                                            <StatusToggle
                                                active={!user.swap_paused}
                                                onToggle={(val) => handleAction('status', 'swap_paused', !val)}
                                            />
                                        </div>

                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-4 bg-secondary/20 border border-border">
                                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Transfer Matrix</span>
                                            <StatusToggle
                                                active={!user.transfer_paused}
                                                onToggle={(val) => handleAction('status', 'transfer_paused', !val)}
                                            />
                                        </div>
                                    </div>

                                    {/* Action Grid */}
                                    <div className="grid grid-cols-2 gap-3 pt-4">
                                        <ActionButton icon={<Edit2 className="w-3 h-3" />} label="Edit Profile" onClick={() => setModal('edit')} />
                                        <ActionButton icon={<Key className="w-3 h-3" />} label="Reset Password" onClick={() => setModal('reset')} />
                                        <ActionButton icon={<LogOut className="w-3 h-3" />} label="Logout User" onClick={() => setModal('logout')} />
                                        <ActionButton icon={<UserMinus className="w-3 h-3" />} label="Delete User" onClick={() => setModal('delete')} danger />

                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "col-span-2 h-12 font-bold uppercase tracking-widest text-[10px] transition-all rounded-none border-border",
                                                user.is_blocked
                                                    ? "bg-green-600/10 text-green-500 border-green-600/50 hover:bg-green-600 hover:text-white"
                                                    : "bg-red-600/10 text-red-500 border-red-600/50 hover:bg-red-600 hover:text-white"
                                            )}
                                            onClick={() => user.is_blocked ? handleAction('status', 'is_blocked', false, '') : setModal('block')}
                                        >
                                            <Lock className="w-3 h-3 mr-2" />
                                            {user.is_blocked ? 'Unlock Account' : 'Lock Account'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Admin Wallet Control Section */}
                        <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                                <Key className="w-16 md:w-24 h-16 md:h-24 text-foreground" />
                            </div>
                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 border border-border bg-secondary">
                                        <WalletIcon className="w-5 h-5 text-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold uppercase tracking-widest">Administrative Hub</h2>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">Direct System Control</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    <ActionButton
                                        icon={<ArrowUpRight className="w-3 h-3" />}
                                        label="System Distribution"
                                        onClick={() => {
                                            setAdminSendStep(1);
                                            setAdminSendTarget(user.email);
                                            setAdminSendModal(true);
                                        }}
                                    />
                                    <Button
                                        variant="outline"
                                        className="h-12 border-border rounded-none font-bold uppercase tracking-widest text-[9px] gap-2 transition-all w-full hover:bg-foreground hover:text-background"
                                        onClick={() => setModal('recreate')}
                                    >
                                        <RefreshCw className="w-3 h-3" /> Re-initialize Wallet
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="referral" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div className="grid gap-8 lg:grid-cols-3">
                        {/* Network Topology */}
                        <div className="lg:col-span-2 space-y-6 bg-card border border-border p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-6 opacity-5 transition-transform group-hover:scale-110 duration-500">
                                <Network className="w-24 h-24 text-foreground" />
                            </div>
                            <div className="relative z-10 space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] flex items-center gap-2">
                                        <Activity className="w-3 h-3" /> Network Graph
                                    </h3>
                                    <div className="h-px bg-border/20 flex-1 ml-6" />
                                </div>
                                <div className="border border-border/10 bg-secondary/10 overflow-hidden">
                                    <NetworkVisualization data={data} isLoading={loading} />
                                </div>
                            </div>
                        </div>

                        {/* Stats Summary */}
                        <div className="space-y-6">
                            <div className="bg-card border border-border p-6 space-y-8 relative overflow-hidden group">
                                <div className="absolute bottom-0 right-0 p-6 opacity-5 transition-transform group-hover:scale-110 duration-500">
                                    <Activity className="w-20 h-20 text-foreground" />
                                </div>

                                <div className="relative z-10 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Network Stats</h3>
                                        <div className="h-px bg-border/20 flex-1 ml-6" />
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        <div className="p-6 bg-secondary/20 border border-border space-y-2">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                <Users className="w-3 h-3" /> Total Referrals
                                            </p>
                                            <p className="text-4xl font-black tracking-tighter text-foreground">{stats.totalReferrals}</p>
                                        </div>
                                        <div className="p-6 bg-secondary/20 border border-border space-y-2">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                <Zap className="w-3 h-3" /> Total Earned
                                            </p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-4xl font-black tracking-tighter text-foreground">{parseFloat(stats.totalEarned || '0').toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">AT</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Referral History */}
                    <div className="bg-card border border-border p-6 md:p-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em] flex items-center gap-2">
                                <Terminal className="w-3 h-3" /> Referral History
                            </h3>
                            <div className="h-px bg-border/20 flex-1 ml-6" />
                        </div>

                        <div className="border border-border/10">
                            <SatelliteLedger referrals={referrals.slice((referralPage - 1) * referralsPerPage, referralPage * referralsPerPage)} isLoading={loading} />
                        </div>

                        {/* Pagination */}
                        {referrals.length > referralsPerPage && (
                            <div className="flex items-center justify-center gap-8 pt-4">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-none border border-border bg-secondary hover:bg-foreground hover:text-background font-black uppercase text-[9px] h-10 px-8 transition-all"
                                    onClick={() => setReferralPage(prev => Math.max(1, prev - 1))}
                                    disabled={referralPage === 1}
                                >
                                    Previous
                                </Button>
                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                                    Page {referralPage} // {Math.ceil(referrals.length / referralsPerPage)}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-none border border-border bg-secondary hover:bg-foreground hover:text-background font-black uppercase text-[9px] h-10 px-8 transition-all"
                                    onClick={() => setReferralPage(prev => Math.min(Math.ceil(referrals.length / referralsPerPage), prev + 1))}
                                    disabled={referralPage >= Math.ceil(referrals.length / referralsPerPage)}
                                >
                                    Next
                                </Button>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="wallet" className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div className="grid gap-8 lg:grid-cols-2">
                        {/* Wallet Detail Card */}
                        <div className="bg-card border border-border p-6 md:p-10 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-10 opacity-5 transition-transform group-hover:scale-110 duration-700">
                                <WalletIcon className="w-24 h-24 text-foreground grayscale" />
                            </div>

                            <div className="relative z-10 space-y-8">
                                <div>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-muted-foreground mb-4">Node Network Address</p>
                                    <div className="flex items-center gap-3 bg-secondary/30 border border-border p-4 group/addr cursor-pointer" onClick={() => {
                                        navigator.clipboard.writeText(user.wallet_address);
                                        showAlert('success', 'Address Captured');
                                    }}>
                                        <Key className="w-5 h-5 text-foreground opacity-50" />
                                        <div className="flex-1 font-mono text-xs md:text-sm truncate opacity-80">{user.wallet_address || 'NOT_INITIALIZED'}</div>
                                        <Copy className="w-4 h-4 text-muted-foreground group-hover/addr:text-foreground transition-colors" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1 h-1 bg-primary rounded-full" /> Native Asset
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black tracking-tighter">{parseFloat(user.balance_ath || '0').toFixed(4)}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground">ATH</span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <div className="w-1 h-1 bg-foreground rounded-full" /> Reward Token
                                        </p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-black tracking-tighter">{parseFloat(user.at_balance || '0').toFixed(2)}</span>
                                            <span className="text-[10px] font-bold text-muted-foreground">AT</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Administrative Control Hub */}
                        <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                                <Shield className="w-20 h-20 text-foreground" />
                            </div>

                            <div className="relative z-10 space-y-8">
                                <div className="flex items-center gap-4">
                                    <div className="p-2 border border-border bg-secondary">
                                        <Network className="w-5 h-5 text-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold uppercase tracking-widest">Management Hub</h2>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">Authorized Protocols</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="p-5 bg-secondary/20 border border-border space-y-4">
                                        <div className="flex items-center gap-3">
                                            <Activity className="w-4 h-4 text-primary" />
                                            <span className="text-[10px] font-mono uppercase tracking-widest">Resource Allocation</span>
                                        </div>
                                        <Button
                                            className="w-full h-12 bg-foreground text-background font-black uppercase text-[10px] tracking-widest rounded-none hover:opacity-90 transition-all border border-foreground"
                                            onClick={() => {
                                                setAdminSendStep(1);
                                                setAdminSendTarget(user.email);
                                                setAdminSendModal(true);
                                            }}
                                        >
                                            <ArrowUpRight className="w-3 h-3 mr-2" /> Distribution Protocol
                                        </Button>
                                    </div>

                                    <div className="p-4 flex items-center justify-between border border-border/50 bg-secondary/10">
                                        <div className="flex items-center gap-3">
                                            <RefreshCw className="w-3 h-3 text-muted-foreground" />
                                            <span className="text-[9px] font-mono uppercase text-muted-foreground tracking-widest">Node Re-initialization</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 border border-border bg-secondary hover:bg-red-500 hover:text-white transition-all text-[9px] uppercase font-black px-4 rounded-none"
                                            onClick={() => setModal('recreate')}
                                        >
                                            Reset Wallet
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="transactions" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-700">
                    <div className="bg-card border border-border min-h-[500px] flex flex-col">
                        <div className="p-4 border-b border-border bg-secondary/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                                <Terminal className="w-3 h-3" /> Transaction Ledger
                            </h3>
                            <div className="relative flex-1 max-w-sm">
                                <Input
                                    placeholder="Search by Hash..."
                                    value={txSearch}
                                />
                            </div>
                            <div className="relative">
                                <select
                                    value={txType}
                                    onChange={(e) => setTxType(e.target.value)}
                                    className="h-9 bg-secondary/50 border border-border px-3 text-[10px] font-mono text-foreground focus:outline-none rounded-none appearance-none pr-8 cursor-pointer uppercase tracking-widest"
                                >
                                    <option value="all">ALL SECTORS</option>
                                    <option value="send">SEND</option>
                                    <option value="receive">RECEIVE</option>
                                    <option value="mining">MINING</option>
                                    <option value="swap">SWAP</option>
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                                    <Activity className="w-3 h-3" />
                                </div>
                            </div>
                        </div>

                        {txLoading ? (
                            <div className="flex-1 flex items-center justify-center p-12">
                                <div className="text-[10px] font-mono text-primary animate-pulse tracking-widest">Synchronizing Ledger...</div>
                            </div>
                        ) : transactions.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center p-12 text-center text-muted-foreground font-mono text-[10px] uppercase tracking-widest">
                                No records found in the specified sector
                            </div>
                        ) : (
                            <div className="divide-y divide-border/50">
                                {transactions.map((tx: any) => (
                                    <div
                                        key={tx.id}
                                        onClick={() => setSelectedTx(tx)}
                                        className="p-4 md:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-secondary/30 transition-colors group cursor-pointer gap-4"
                                    >
                                        <div className="flex items-center gap-4 flex-1 min-w-0">
                                            <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center border ${tx.type === 'receive' || tx.type === 'mining' || tx.type.startsWith('mine_') ? 'border-green-500/30 text-green-500' : 'border-border text-foreground'}`}>
                                                {tx.type === 'receive' || tx.type === 'mining' || tx.type.startsWith('mine_') ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-[11px] font-black text-foreground uppercase tracking-widest">{tx.type.replace('_', ' ')}</p>
                                                <p className="text-[10px] font-mono text-muted-foreground truncate opacity-60 mt-0.5">
                                                    {new Date(tx.timestamp).toLocaleString()} • {tx.txHash}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex sm:flex-col justify-between items-end gap-2 flex-shrink-0">
                                            <p className={`font-mono font-bold text-sm ${tx.type === 'receive' || tx.type === 'mining' || tx.type.startsWith('mine_') ? 'text-green-500' : 'text-foreground'}`}>
                                                {tx.type === 'swap' && tx.metadata?.fromToken ? (
                                                    <span className="flex flex-col items-end">
                                                        <span className="text-red-500/80 text-[9px] font-mono">-{tx.metadata.fromAmount} {tx.metadata.fromToken}</span>
                                                        <span className="text-green-500 text-[11px] font-mono">+{tx.metadata.toAmount} {tx.metadata.toToken}</span>
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
                        {txTotalPages > 1 && (
                            <div className="p-4 border-t border-border flex items-center justify-between bg-secondary/10">
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em]">
                                    Sector {txPage} // {txTotalPages}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={txPage === 1}
                                        onClick={() => setTxPage(p => Math.max(1, p - 1))}
                                        className="h-8 rounded-none border-border bg-background text-[9px] font-black uppercase transition-all px-4"
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={txPage >= txTotalPages}
                                        onClick={() => setTxPage(p => p + 1)}
                                        className="h-8 rounded-none border-border bg-background text-[9px] font-black uppercase transition-all px-4"
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <AnimatePresence>
                {/* Block User Modal */}
                {modal === 'block' && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 text-foreground">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="w-full max-w-md"
                        >
                            <div className="bg-card border border-border shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                                    <Lock className="w-20 h-20 text-red-500" />
                                </div>

                                <div className="relative z-10 p-8 space-y-8">
                                    <div className="flex flex-col gap-2">
                                        <h2 className="text-xl font-black uppercase tracking-widest text-red-500">Block User</h2>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Manual Override // {user.username}</p>
                                    </div>

                                    <div className="space-y-6">
                                        <p className="text-[12px] text-foreground/70 leading-relaxed font-mono">
                                            WARNING: Confirming the restriction of <strong>{user.username}</strong>. All system access will be immediately disabled.
                                        </p>

                                        <div className="space-y-3">
                                            <label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Reason for blocking</label>
                                            <textarea
                                                className="flex min-h-[120px] w-full border border-border bg-secondary/30 px-4 py-4 text-sm font-mono placeholder:text-muted-foreground/30 focus:outline-none focus:border-red-500/50 transition-all text-foreground rounded-none"
                                                placeholder="Document the reason for restriction..."
                                                value={blockReason}
                                                onChange={(e) => setBlockReason(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex gap-4 pt-4">
                                            <Button
                                                variant="ghost"
                                                className="flex-1 border border-border hover:bg-foreground hover:text-background rounded-none h-12 font-black uppercase tracking-widest text-[10px] transition-all"
                                                onClick={() => setModal(null)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-none h-12 font-black uppercase tracking-widest text-[10px] transition-all"
                                                onClick={() => handleAction('status', 'is_blocked', true, blockReason)}
                                            >
                                                Confirm Block
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Standard Modals */}
                <EditUserModal
                    user={user}
                    isOpen={modal === 'edit'}
                    onClose={() => setModal(null)}
                    onSuccess={() => { fetchDetails(); setModal(null); showAlert('success', 'Profile Updated'); }}
                />

                <ResetPasswordModal
                    user={user}
                    isOpen={modal === 'reset'}
                    onClose={() => setModal(null)}
                    onSuccess={() => { fetchDetails(); setModal(null); showAlert('success', 'Password Reset'); }}
                />

                <ConfirmModal
                    isOpen={modal === 'delete'}
                    onClose={() => setModal(null)}
                    onConfirm={() => handleAction('delete')}
                    title="Delete User Permanently?"
                    message="This will remove the user, their wallet, and all related data. This cannot be undone."
                    confirmText="Delete User"
                    variant="destructive"
                />

                <ConfirmModal
                    isOpen={modal === 'logout'}
                    onClose={() => setModal(null)}
                    onConfirm={() => handleAction('logout')}
                    title="Force Logout?"
                    message="The user will be logged out immediately."
                    confirmText="Logout User"
                />

                <ConfirmModal
                    isOpen={modal === 'recreate'}
                    onClose={() => setModal(null)}
                    onConfirm={handleRecreateWallet}
                    title="Initialize Fresh Node?"
                    message="WARNING: This will permanently replace the user's existing blockchain identity. Old assets will be inaccessible unless the private key was exported. Proceed with caution."
                    confirmText={isRecreating ? "Initializing..." : "Proceed with Refresh"}
                    variant="destructive"
                />

                {/* System Distribution Modal */}
                {adminSendModal && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-background/90 backdrop-blur-xl p-4">
                        <motion.div
                            initial={{ opacity: 0, y: 30, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 30, scale: 0.95 }}
                            className="w-full max-w-lg bg-card border border-border shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] relative overflow-hidden"
                        >
                            {/* Industrial Accents */}
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-foreground/10" />
                            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-primary/20" />
                            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-primary/20" />

                            <div className="p-8 space-y-10 relative">
                                {/* Header */}
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-3">
                                            <Shield className="w-5 h-5 text-primary" />
                                            <h2 className="text-xl font-black uppercase tracking-widest">System Distribution</h2>
                                        </div>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Protocol Override // Treasury Access</p>
                                    </div>
                                    <button onClick={() => setAdminSendModal(false)} className="p-2 hover:bg-secondary border border-transparent hover:border-border transition-all">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {adminSendStep === 1 && (
                                    <div className="space-y-8 animate-in fade-in duration-500">
                                        <div className="space-y-6">
                                            {/* Identifier Type */}
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Routing Method</label>
                                                <div className="grid grid-cols-3 gap-1 p-1 bg-secondary/30 border border-border">
                                                    {(['email', 'username', 'address'] as const).map((t) => (
                                                        <Button
                                                            key={t}
                                                            variant="ghost"
                                                            className={cn(
                                                                "h-10 text-[9px] font-black uppercase tracking-widest rounded-none",
                                                                adminSendType === t ? "bg-foreground text-background" : "text-muted-foreground"
                                                            )}
                                                            onClick={() => setAdminSendType(t)}
                                                        >
                                                            {t === 'email' ? <Mail className="w-3 h-3 mr-2" /> : t === 'username' ? <AtSign className="w-3 h-3 mr-2" /> : <Database className="w-3 h-3 mr-2" />}
                                                            {t}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Recipient Input */}
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Recipient Identity</label>
                                                <div className="relative">
                                                    <Input
                                                        className="h-14 bg-secondary/20 border-border rounded-none pl-12 font-mono text-sm focus-visible:ring-0 focus-visible:border-primary transition-all"
                                                        placeholder={adminSendType === 'email' ? "distribute@node.network" : adminSendType === 'username' ? "@operator" : "0x00...000"}
                                                        value={adminSendTarget}
                                                        onChange={(e) => setAdminSendTarget(e.target.value)}
                                                    />
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                                                        <Search className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full h-14 bg-foreground text-background font-black uppercase tracking-widest text-xs rounded-none hover:opacity-90"
                                            onClick={() => setAdminSendStep(2)}
                                            disabled={!adminSendTarget}
                                        >
                                            Next Protocol <ChevronRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </div>
                                )}

                                {adminSendStep === 2 && (
                                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                                        <div className="space-y-6">
                                            {/* Asset Selection */}
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Asset Category</label>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {(['ATH', 'WATH'] as const).map((a) => (
                                                        <button
                                                            key={a}
                                                            className={cn(
                                                                "flex items-center justify-between p-4 border transition-all group",
                                                                adminSendAsset === a ? "bg-foreground text-background border-foreground" : "bg-secondary/10 border-border hover:border-foreground/50"
                                                            )}
                                                            onClick={() => setAdminSendAsset(a)}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <Coins className={cn("w-5 h-5", adminSendAsset === a ? "text-background" : "text-muted-foreground group-hover:text-foreground")} />
                                                                <span className="font-black tracking-widest text-xs">{a}</span>
                                                            </div>
                                                            {adminSendAsset === a && <Activity className="w-4 h-4 animate-pulse" />}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Amount Input */}
                                            <div className="space-y-3">
                                                <label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Distribution Quantum</label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        className="h-14 bg-secondary/20 border-border rounded-none pl-6 font-mono text-2xl focus-visible:ring-0 focus-visible:border-primary transition-all tracking-tighter"
                                                        placeholder="0.00"
                                                        value={adminSendAmount}
                                                        onChange={(e) => {
                                                            setAdminSendAmount(e.target.value);
                                                            setAdminSendGas(null);
                                                        }}
                                                    />
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground text-[10px] tracking-widest uppercase">
                                                        Tokens Available
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Gas Estimation Detail */}
                                            {adminSendAmount && parseFloat(adminSendAmount) > 0 && (
                                                <div className="p-4 bg-primary/5 border border-primary/20 space-y-3">
                                                    <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-widest">
                                                        <span className="text-muted-foreground">Estimated Network Fee</span>
                                                        <div className="flex items-center gap-2">
                                                            {isEstimatingGas ? (
                                                                <Loader2 className="w-3 h-3 animate-spin text-primary" />
                                                            ) : adminSendGas ? (
                                                                <span className="text-foreground font-black">{adminSendGas.fee} ATH</span>
                                                            ) : (
                                                                <button
                                                                    onClick={fetchAdminSendGas}
                                                                    className="text-primary hover:underline"
                                                                >
                                                                    Fetch Gas
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {adminSendGas && (
                                                        <div className="text-[9px] font-mono text-muted-foreground truncate opacity-60">
                                                            Target: {adminSendGas.to}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                variant="ghost"
                                                className="h-14 border border-border rounded-none uppercase font-black tracking-widest text-[10px]"
                                                onClick={() => setAdminSendStep(1)}
                                            >
                                                Back
                                            </Button>
                                            <Button
                                                className="h-14 bg-foreground text-background font-black uppercase tracking-widest text-[10px] rounded-none hover:opacity-90 flex items-center justify-center gap-2"
                                                onClick={handleAdminSend}
                                                disabled={!adminSendAmount || parseFloat(adminSendAmount) <= 0 || !adminSendGas || isAdminSending}
                                            >
                                                {isAdminSending ? <Loader2 className="w-4 h-4 animate-spin text-background" /> : <Zap className="w-4 h-4" />}
                                                {isAdminSending ? "Authorizing..." : "Initiate Send"}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {adminSendStep === 3 && adminSendTx && (
                                    <div className="space-y-8 animate-in zoom-in duration-500 text-center py-4">
                                        <div className="w-20 h-20 bg-green-500/20 border-2 border-green-500 flex items-center justify-center mx-auto mb-6">
                                            <ShieldCheck className="w-10 h-10 text-green-500" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="text-2xl font-black uppercase tracking-widest">Protocol Executed</h3>
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase">Distribution Sequence Successfully Indexed</p>
                                        </div>

                                        <div className="bg-secondary/30 border border-border p-6 space-y-4 text-left">
                                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                                <span className="text-[9px] font-mono uppercase text-muted-foreground">Asset Distributed</span>
                                                <span className="text-sm font-black font-mono">{adminSendAmount} {adminSendAsset}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                                <span className="text-[9px] font-mono uppercase text-muted-foreground">Network Target</span>
                                                <span className="text-[10px] font-mono opacity-80 truncate ml-4 max-w-[200px]">{adminSendTx.recipient}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                                <span className="text-[9px] font-mono uppercase text-muted-foreground">Block Index</span>
                                                <span className="text-[10px] font-mono opacity-80">{adminSendTx.blockNumber || 'PENDING'}</span>
                                            </div>
                                            <div className="flex justify-between items-center border-b border-border/50 pb-2">
                                                <span className="text-[9px] font-mono uppercase text-muted-foreground">Resources Burned</span>
                                                <span className="text-[10px] font-mono opacity-80">{adminSendTx.gasUsed || 'CALCULATING'} ATH</span>
                                            </div>
                                            <div className="space-y-2 pt-2">
                                                <span className="text-[9px] font-mono uppercase text-muted-foreground">Hash Signature</span>
                                                <div className="bg-background/50 p-3 text-[10px] font-mono break-all opacity-60 leading-relaxed tracking-tighter uppercase border border-border/20">
                                                    {adminSendTx.txHash}
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full h-14 bg-foreground text-background font-black uppercase tracking-widest text-[10px] rounded-none"
                                            onClick={() => setAdminSendModal(false)}
                                        >
                                            Close Terminal
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Transaction Details Modal */}
                {selectedTx && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-2xl bg-card border border-border shadow-2xl relative overflow-hidden"
                        >
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                            <div className="p-8 relative">
                                {/* Close Button */}
                                <button
                                    onClick={() => setSelectedTx(null)}
                                    className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                {/* Header */}
                                <div className="flex items-center gap-3 mb-8">
                                    <ShieldCheck className="w-5 h-5 text-foreground" />
                                    <div className="h-px flex-1 bg-border/20" />
                                    <span className="text-[10px] font-black font-mono text-muted-foreground uppercase tracking-[0.4em]">
                                        Transaction Receipt
                                    </span>
                                </div>

                                {/* Status + Amount */}
                                <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 mb-10">
                                    <div className="space-y-1">
                                        <h3 className="text-2xl font-black uppercase tracking-widest">
                                            {selectedTx.status === 'completed' ? 'SUCCESSFUL' : selectedTx.status.toUpperCase()}
                                        </h3>
                                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em]">
                                            {selectedTx.type === 'receive' ? 'Digital Asset Receipt' : selectedTx.type === 'swap' ? 'Token Exchange' : 'Network Transfer'}
                                        </p>
                                    </div>

                                    <div className="text-left md:text-right">
                                        {selectedTx.type === 'swap' && selectedTx.metadata?.fromToken ? (
                                            <div className="flex flex-col items-end gap-1">
                                                <p className="text-base font-mono font-bold tracking-tight text-red-500/80">
                                                    -{selectedTx.metadata.fromAmount} {selectedTx.metadata.fromToken}
                                                </p>
                                                <p className="text-2xl font-mono font-bold tracking-tight text-green-500">
                                                    +{selectedTx.metadata.toAmount} {selectedTx.metadata.toToken}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-1">
                                                <p className={`text-4xl font-black tracking-tighter ${selectedTx.type === 'receive' || selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_') ? 'text-green-500' : 'text-foreground'}`}>
                                                    {selectedTx.type === 'receive' || selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_') ? '+' : '-'}
                                                    {selectedTx.amount}{' '}
                                                    <span className="text-xs font-bold uppercase ml-1 opacity-50">
                                                        {selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_') ? 'AT' : 'ATH'}
                                                    </span>
                                                </p>
                                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
                                                    Network Settled
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Details Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-8 md:gap-x-12 border-t border-border/20 pt-8 font-mono">
                                    <div>
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Sender Protocol</p>
                                        <div className="bg-secondary/20 border border-border p-3 overflow-hidden">
                                            <p className="text-[10px] truncate">
                                                {selectedTx.type === 'swap' ? "Liquidity Layer" : selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_') ? "System Protocol" : selectedTx.fromAddress || 'INTERNAL_TRANSIT'}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2 text-left md:text-right">Recipient Node</p>
                                        <div className="bg-secondary/20 border border-border p-3 overflow-hidden">
                                            <p className="text-[10px] truncate text-left md:text-right">
                                                {selectedTx.type === 'swap' ? selectedTx.metadata?.userAddress || 'N/A' : selectedTx.type === 'mining' || selectedTx.type.startsWith('mine_') ? user.username : selectedTx.toAddress || selectedTx.recipient || 'N/A'}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Index Date</p>
                                        <p className="text-[11px] font-bold uppercase">{new Date(selectedTx.timestamp).toLocaleString()}</p>
                                    </div>

                                    <div className="md:text-right">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Network Fee</p>
                                        <p className="text-[11px] font-bold uppercase">{selectedTx.fee || '0'} ATH</p>
                                    </div>

                                    <div className="md:col-span-2">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-2">Hash Signature</p>
                                        <div className="bg-secondary/20 border border-border p-3">
                                            <p className="text-[10px] break-all opacity-60 leading-relaxed uppercase tracking-tighter">
                                                {selectedTx.txHash}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-8 flex justify-end">
                                    <Button
                                        variant="outline"
                                        onClick={() => setSelectedTx(null)}
                                        className="rounded-none border-border uppercase font-black tracking-widest text-[10px] h-10 px-8 hover:bg-foreground hover:text-background"
                                    >
                                        Dismiss Receipt
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function MetricCard({ title, icon, children, className }: any) {
    return (
        <div className={cn("bg-card border border-border p-5 relative overflow-hidden group", className)}>
            <div className="flex justify-between items-start mb-4">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">{title}</span>
                <div className="p-1.5 border border-border bg-secondary group-hover:bg-foreground group-hover:text-background transition-colors">
                    {icon}
                </div>
            </div>
            <div className="space-y-1">
                {children}
            </div>
        </div>
    );
}

function ActionButton({ icon, label, onClick, danger }: any) {
    return (
        <Button
            variant="outline"
            className={cn(
                "h-12 border-border rounded-none font-bold uppercase tracking-widest text-[9px] gap-2 transition-all w-full",
                danger
                    ? "hover:bg-red-600 hover:text-white hover:border-red-600"
                    : "hover:bg-foreground hover:text-background hover:border-foreground"
            )}
            onClick={onClick}
        >
            {icon} {label}
        </Button>
    );
}

function StatusToggle({ active, onToggle }: { active: boolean, onToggle: (val: boolean) => void }) {
    return (
        <div className="flex bg-secondary/30 border border-border p-1 w-full sm:w-[240px]">
            <button
                onClick={() => !active && onToggle(true)}
                className={`flex-1 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 rounded-none border ${active
                    ? 'bg-foreground text-background border-foreground shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
            >
                Enabled
            </button>
            <button
                onClick={() => active && onToggle(false)}
                className={`flex-1 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 rounded-none border ${!active
                    ? 'bg-red-600 text-white border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                    : 'text-muted-foreground border-transparent hover:text-red-400'
                    }`}
            >
                Disabled
            </button>
        </div>
    );
}
