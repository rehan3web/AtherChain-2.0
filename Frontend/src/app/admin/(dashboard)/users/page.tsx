'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/providers/AlertProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User as UserIcon, Shield, Pickaxe, Ban, ChevronRight, Filter, Zap, RefreshCw, Edit, LogOut, Trash2, Key } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EditUserModal, ConfirmModal, ResetPasswordModal } from '@/components/admin/UserModals';

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [modal, setModal] = useState<'edit' | 'delete' | 'logout' | 'reset' | null>(null);
    const { showAlert } = useAlert();

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('admin_token');
            const res = await api.get(`/admin/users?search=${search}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(res.data.users);
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Error fetching users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const toggleStatus = async (userId: string, field: string, currentValue: boolean, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigation to user detail
        const token = localStorage.getItem('admin_token');
        try {
            await api.patch(`/admin/users/${userId}`, { [field]: !currentValue }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers();
        } catch (error) {
            showAlert('danger', 'Update failed');
        }
    };

    const handleAction = (user: any, action: 'edit' | 'delete' | 'logout' | 'reset', e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedUser(user);
        setModal(action);
    };

    const confirmAction = async () => {
        if (!selectedUser || !modal) return;

        try {
            const token = localStorage.getItem('admin_token');
            if (modal === 'delete') {
                await api.delete(`/admin/users/${selectedUser.id}`, { headers: { Authorization: `Bearer ${token}` } });
            } else if (modal === 'logout') {
                await api.post(`/admin/users/${selectedUser.id}/logout`, {}, { headers: { Authorization: `Bearer ${token}` } });
            }
            fetchUsers();
            setModal(null);
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Action failed');
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Search Section */}
            <div className="flex flex-col md:flex-row justify-end items-stretch md:items-center gap-4">
                <div className="relative flex-1 group max-w-full md:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={20} />
                    <Input
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
                        className="pl-12 h-12 bg-card border-border text-foreground placeholder:text-muted-foreground font-mono text-sm tracking-widest focus:ring-1 focus:ring-primary focus:border-primary transition-all rounded-xl"
                    />
                </div>
                <Button
                    variant="default"
                    size="sm"
                    onClick={fetchUsers}
                    className="h-12 px-6 font-black tracking-widest uppercase"
                >
                    Search
                </Button>
            </div>

            {/* Desktop Table View */}
            <Card className="hidden @[48rem]/main:block relative overflow-hidden border-border bg-card shadow-sm rounded-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-muted/50">
                                <th className="p-6 text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground">User</th>
                                <th className="p-6 text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground text-center">Balances</th>
                                <th className="p-6 text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground text-center">Status</th>
                                <th className="p-6 text-[11px] font-black uppercase tracking-[0.3em] text-muted-foreground text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading && users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="p-20 text-center animate-pulse">
                                        <div className="text-primary font-mono tracking-[0.5em] uppercase">Loading...</div>
                                    </td>
                                </tr>
                            ) : users.map((user, index) => (
                                <motion.tr
                                    key={user.id}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    whileHover={{ backgroundColor: "hsl(var(--muted)/0.4)" }}
                                    className="group cursor-pointer transition-all duration-300 relative"
                                    onClick={() => window.location.href = `/admin/users/${user.id}`}
                                >
                                    <td className="p-6">
                                        <div className="flex items-center gap-5">
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border border-border group-hover:border-primary/50 transition-colors duration-500 overflow-hidden">
                                                    <UserIcon size={24} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                                </div>
                                                {user.is_blocked && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full border-2 border-card" />
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <div className="text-lg font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
                                                    {user.username}
                                                </div>
                                                <div className="text-xs text-muted-foreground font-medium lowercase">
                                                    {user.email}
                                                </div>
                                                <div className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-[0.2em]">
                                                    UID: {user.id}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-6">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-border">
                                                <Zap size={12} className="text-primary" />
                                                <span className="text-sm font-bold text-foreground font-mono">{user.balance_at || 0}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">AT</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-muted/20 px-3 py-1.5 rounded-lg border border-border">
                                                <RefreshCw size={12} className="text-primary" />
                                                <span className="text-sm font-bold text-foreground font-mono">{user.balance_ath || 0}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase">ATH</span>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-6">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase border transition-all ${user.kyc_status === 'approved'
                                                ? 'bg-primary/10 text-primary border-primary/20'
                                                : user.kyc_status === 'pending'
                                                    ? 'bg-muted text-muted-foreground border-border'
                                                    : 'bg-destructive/10 text-destructive border-destructive/20'
                                                }`}>
                                                {user.kyc_status}
                                            </div>
                                            <div className={`text-[9px] font-mono tracking-widest uppercase ${user.is_blocked ? 'text-destructive' : 'text-muted-foreground'}`}>
                                                {user.is_blocked ? 'Blocked' : 'Active'}
                                            </div>
                                        </div>
                                    </td>

                                    <td className="p-6">
                                        <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-4 group-hover:translate-x-0">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => handleAction(user, 'edit', e)}>
                                                <Edit size={14} />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => handleAction(user, 'reset', e)}>
                                                <Key size={14} />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={(e) => handleAction(user, 'logout', e)}>
                                                <LogOut size={14} />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => handleAction(user, 'delete', e)}>
                                                <Trash2 size={14} />
                                            </Button>
                                            <div className="w-px h-4 bg-border mx-2" />
                                            <Button
                                                size="sm"
                                                variant={user.is_blocked ? 'default' : 'destructive'}
                                                onClick={(e) => toggleStatus(user.id, 'is_blocked', user.is_blocked, e)}
                                                className="h-8 px-3 text-[9px] font-black uppercase tracking-widest rounded-lg"
                                            >
                                                {user.is_blocked ? 'Unblock' : 'Block'}
                                            </Button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Mobile Card View */}
            <div className="block @[48rem]/main:hidden space-y-4">
                {loading && users.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="text-primary font-mono tracking-[0.5em] uppercase animate-pulse">Loading...</div>
                    </div>
                ) : users.map((user) => (
                    <Card key={user.id} className="p-6 bg-card border-border border shadow-sm rounded-xl space-y-6" onClick={() => window.location.href = `/admin/users/${user.id}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center border border-border overflow-hidden">
                                    <UserIcon size={24} className="text-muted-foreground" />
                                </div>
                                <div className="space-y-0.5">
                                    <div className="text-lg font-bold text-foreground tracking-tight">{user.username}</div>
                                    <div className="text-xs text-muted-foreground lowercase">{user.email}</div>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${user.kyc_status === 'approved' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-muted text-muted-foreground border-border'}`}>
                                {user.kyc_status}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-muted/20 p-3 rounded-lg border border-border flex flex-col items-center">
                                <Zap size={14} className="text-primary mb-1" />
                                <span className="text-sm font-bold font-mono">{user.balance_at || 0}</span>
                                <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">AT Balance</span>
                            </div>
                            <div className="bg-muted/20 p-3 rounded-lg border border-border flex flex-col items-center">
                                <RefreshCw size={14} className="text-primary mb-1" />
                                <span className="text-sm font-bold font-mono">{user.balance_ath || 0}</span>
                                <span className="text-[9px] font-black text-muted-foreground uppercase opacity-40">ATH Balance</span>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-1">
                                <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground" onClick={(e) => handleAction(user, 'edit', e)}>
                                    <Edit size={18} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground" onClick={(e) => handleAction(user, 'reset', e)}>
                                    <Key size={18} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-10 w-10 text-muted-foreground" onClick={(e) => handleAction(user, 'logout', e)}>
                                    <LogOut size={18} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive" onClick={(e) => handleAction(user, 'delete', e)}>
                                    <Trash2 size={18} />
                                </Button>
                            </div>
                            <Button
                                size="sm"
                                variant={user.is_blocked ? 'default' : 'destructive'}
                                onClick={(e) => toggleStatus(user.id, 'is_blocked', user.is_blocked, e)}
                                className="h-10 px-4 text-[10px] font-black uppercase tracking-widest rounded-lg"
                            >
                                {user.is_blocked ? 'Unblock' : 'Block'}
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Footer Pagination (Simplified for UI look) */}
            <div className="flex justify-between items-center px-4">
                <div className="text-muted-foreground font-mono text-xs uppercase tracking-[0.3em]">
                    Displaying <span className="text-foreground">{users.length}</span> Users
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" className="opacity-50" disabled>Back</Button>
                    <Button variant="outline" className="opacity-50" disabled>Next</Button>
                </div>
            </div>
            <EditUserModal
                user={selectedUser}
                isOpen={modal === 'edit'}
                onClose={() => setModal(null)}
                onSuccess={() => { fetchUsers(); setModal(null); }}
            />

            <ResetPasswordModal
                user={selectedUser}
                isOpen={modal === 'reset'}
                onClose={() => setModal(null)}
                onSuccess={() => { fetchUsers(); setModal(null); }}
            />

            <ConfirmModal
                isOpen={modal === 'delete'}
                onClose={() => setModal(null)}
                onConfirm={confirmAction}
                title="Delete User Permanently?"
                message="This will remove the user, their wallet, and all related data. This cannot be undone."
                confirmText="Delete User"
                variant="destructive"
            />

            <ConfirmModal
                isOpen={modal === 'logout'}
                onClose={() => setModal(null)}
                onConfirm={confirmAction}
                title="Force Logout?"
                message="The user will be logged out immediately."
                confirmText="Logout User"
            />
        </div>
    );
}
