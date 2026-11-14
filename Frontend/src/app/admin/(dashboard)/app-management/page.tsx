'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/providers/AlertProvider';
import { Smartphone, Plus, Trash2, ShieldAlert } from 'lucide-react';

interface AppVersion {
    id: string;
    version: string;
    is_allowed: boolean;
    created_at: string;
}

export default function AppManagementPage() {
    const [versions, setVersions] = useState<AppVersion[]>([]);
    const [newVersion, setNewVersion] = useState('');
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const { showAlert } = useAlert();

    const fetchVersions = async () => {
        const token = localStorage.getItem('admin_token');
        try {
            const res = await api.get('/admin/app-versions', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setVersions(res.data);
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Error fetching app versions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVersions();
    }, []);

    const handleAddVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newVersion.trim()) return;

        setAdding(true);
        const token = localStorage.getItem('admin_token');
        try {
            await api.post('/admin/app-versions', {
                version: newVersion.trim(),
                is_allowed: true
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showAlert('success', 'App version added successfully');
            setNewVersion('');
            fetchVersions();
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Failed to add version');
        } finally {
            setAdding(false);
        }
    };

    const handleToggleAllowed = async (id: string, currentStatus: boolean) => {
        const token = localStorage.getItem('admin_token');
        try {
            await api.put(`/admin/app-versions/${id}`, {
                is_allowed: !currentStatus
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showAlert('success', `Version is now ${!currentStatus ? 'allowed' : 'blocked'}`);
            fetchVersions();
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Failed to toggle status');
        }
    };

    const handleDeleteVersion = async (id: string) => {
        if (!confirm('Are you sure you want to delete this version?')) return;

        const token = localStorage.getItem('admin_token');
        try {
            await api.delete(`/admin/app-versions/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showAlert('success', 'App version deleted successfully');
            fetchVersions();
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Failed to delete version');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-black uppercase tracking-widest text-foreground">App Management</h1>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Version Enforcement & Security Gates</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Side: Add Version form */}
                <div className="bg-card border border-border p-6 md:p-8 space-y-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                        <Smartphone className="w-16 h-16 text-foreground" />
                    </div>

                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-4">
                            <div className="p-2 border border-border bg-secondary">
                                <Plus className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold uppercase tracking-widest">Register Version</h2>
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">Whitelist New App Client</p>
                            </div>
                        </div>

                        <form onSubmit={handleAddVersion} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">
                                    Version Name (e.g. 1.1.1)
                                </label>
                                <Input
                                    type="text"
                                    placeholder="Enter version..."
                                    value={newVersion}
                                    onChange={(e) => setNewVersion(e.target.value)}
                                    className="bg-background border-border h-12 font-mono text-sm text-foreground focus:ring-0 focus:border-foreground transition-colors rounded-none"
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={adding || !newVersion.trim()}
                                className="h-12 w-full font-bold uppercase tracking-widest bg-foreground text-background border-border hover:bg-background hover:text-foreground hover:border transition-all rounded-none"
                            >
                                {adding ? 'Adding...' : 'Add Version'}
                            </Button>
                        </form>

                        <div className="p-4 border border-red-900/30 bg-red-950/20 text-red-400 text-xs font-mono rounded-none flex items-start gap-3">
                            <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <div>
                                <p className="font-bold uppercase tracking-wider mb-1">Security Guard:</p>
                                <p className="text-[10px] leading-relaxed">
                                    Only versions added and enabled in this whitelist are permitted to launch the AtherChain app. Unregistered versions will block user entrance.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Version Whitelist List */}
                <div className="lg:col-span-2 bg-card border border-border p-6 md:p-8 space-y-6 relative">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                        <div className="flex items-center gap-4">
                            <div className="p-2 border border-border bg-secondary">
                                <Smartphone className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold uppercase tracking-widest">Version Whitelist</h2>
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">Authorized App Builds</p>
                            </div>
                        </div>
                        <span className="text-[10px] font-mono bg-secondary border border-border px-3 py-1 text-muted-foreground tracking-widest uppercase">
                            {versions.length} Build(s)
                        </span>
                    </div>

                    {versions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border p-6">
                            <Smartphone className="w-8 h-8 text-muted-foreground opacity-30 mb-3" />
                            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">No app versions registered yet</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto w-full">
                            <table className="w-full text-left font-mono border-collapse">
                                <thead>
                                    <tr className="border-b border-border text-[9px] uppercase tracking-widest text-muted-foreground">
                                        <th className="py-3 px-4">Version</th>
                                        <th className="py-3 px-4">Access Status</th>
                                        <th className="py-3 px-4">Added Date</th>
                                        <th className="py-3 px-4 text-right">Operations</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40 text-xs">
                                    {versions.map((ver) => (
                                        <tr key={ver.id} className="hover:bg-secondary/20 transition-colors">
                                            <td className="py-4 px-4 font-bold text-foreground text-sm">{ver.version}</td>
                                            <td className="py-4 px-4">
                                                <button
                                                    onClick={() => handleToggleAllowed(ver.id, ver.is_allowed)}
                                                    className={`px-3 py-1 text-[9px] font-black uppercase tracking-wider border transition-all duration-300 ${ver.is_allowed
                                                        ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 shadow-[0_0_10px_rgba(159,232,112,0.05)]'
                                                        : 'bg-red-950/20 text-red-500 border-red-900/30 hover:bg-red-950/40 shadow-[0_0_10px_rgba(220,38,38,0.05)]'
                                                        }`}
                                                >
                                                    {ver.is_allowed ? 'ALLOWED' : 'BLOCKED'}
                                                </button>
                                            </td>
                                            <td className="py-4 px-4 text-muted-foreground text-[10px]">
                                                {new Date(ver.created_at).toLocaleDateString(undefined, {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric'
                                                })}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => handleDeleteVersion(ver.id)}
                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-950/10 rounded-none border border-transparent hover:border-red-900/30 transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
