'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Search, MapPin, Calendar, User, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function KycQueuePage() {
    const router = useRouter();
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('pending');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState<any>({});

    const fetchQueue = async () => {
        setLoading(true);
        const token = localStorage.getItem('admin_token');
        try {
            const res = await api.get(`/admin/kyc?status=${statusFilter}&search=${search}&page=${page}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRequests(res.data.requests);
            setPagination(res.data.pagination);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, [statusFilter, page]);

    return (
        <div className="space-y-8 w-full animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-2xl font-black uppercase tracking-widest text-foreground">KYC Request Queue</h1>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Identity Verification</p>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                <div className="flex bg-secondary/30 p-1 border border-border overflow-x-auto no-scrollbar w-full lg:w-auto">
                    {['pending', 'approved', 'rejected', 'all'].map((s) => (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); setPage(1); }}
                            className={`px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors whitespace-nowrap flex-1 lg:flex-none ${statusFilter === s
                                ? 'bg-foreground text-background shadow-none border border-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'
                                }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>

                <div className="relative group w-full lg:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-foreground transition-colors" size={18} />
                    <Input
                        placeholder="SEARCH QUEUE..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchQueue()}
                        className="pl-12 h-12 bg-background border-border text-foreground placeholder:text-muted-foreground font-mono text-sm tracking-widest focus:ring-0 focus:border-foreground rounded-none transition-colors"
                    />
                </div>
            </div>

            {/* Content List */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {loading ? (
                        [...Array(6)].map((_, i) => (
                            <div key={i} className="h-64 bg-secondary/20 border border-border animate-pulse" />
                        ))
                    ) : requests.length === 0 ? (
                        <div className="col-span-full py-32 text-center border border-dashed border-border/50 bg-secondary/10">
                            <div className="text-muted-foreground font-mono text-sm tracking-[0.5em] uppercase">No active requests found</div>
                        </div>
                    ) : (
                        requests.map((req, index) => (
                            <motion.div
                                key={req.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                layout
                            >
                                <div
                                    className="group relative overflow-hidden bg-card border border-border hover:border-foreground transition-colors p-6 md:p-8 cursor-pointer shadow-none flex flex-col h-full"
                                    onClick={() => router.push(`/admin/kyc/${req.id}`)}
                                >
                                    <div className="absolute top-0 right-0 p-6 opacity-10 transition-transform group-hover:scale-110 duration-500">
                                        <ShieldCheck className="w-16 h-16 text-foreground" />
                                    </div>

                                    <div className="relative z-10 flex flex-col h-full space-y-6">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1.5">
                                                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-none bg-foreground"></div>
                                                    {req.id_type}
                                                </div>
                                                <h3 className="text-lg font-bold text-foreground tracking-widest uppercase group-hover:text-primary transition-colors line-clamp-1">
                                                    {req.full_name}
                                                </h3>
                                                <p className="text-muted-foreground text-xs font-mono tracking-wider truncate">{req.email}</p>
                                            </div>
                                            <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] border ${req.status === 'pending' ? 'bg-secondary text-muted-foreground border-border' :
                                                req.status === 'approved' ? 'bg-primary/10 text-primary border-primary/30' :
                                                    'bg-destructive/10 text-destructive border-destructive/30'
                                                }`}>
                                                {req.status}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 py-4 border-y border-border/50 mt-auto">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <MapPin size={12} className="text-foreground" />
                                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{req.country}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Calendar size={12} className="text-foreground" />
                                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">{new Date(req.submitted_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-2">
                                            <div className="flex items-center gap-3">
                                                <div className="w-6 h-6 bg-secondary flex items-center justify-center border border-border">
                                                    <User size={12} className="text-foreground" />
                                                </div>
                                                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em]">{req.username}</span>
                                            </div>
                                            <div className="w-8 h-8 bg-secondary border border-border flex items-center justify-center text-muted-foreground group-hover:bg-foreground group-hover:text-background transition-colors">
                                                <ChevronRight size={16} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
                <div className="flex justify-center items-center gap-4 pt-10">
                    <Button
                        variant="outline"
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="h-12 px-6 rounded-xl border-border"
                    >
                        Previous
                    </Button>
                    <div className="text-muted-foreground font-mono text-sm uppercase tracking-widest">
                        Page <span className="text-primary">{page}</span> / {pagination.pages}
                    </div>
                    <Button
                        variant="outline"
                        disabled={page === pagination.pages}
                        onClick={() => setPage(page + 1)}
                        className="h-12 px-6 rounded-xl border-border"
                    >
                        Next
                    </Button>
                </div>
            )}
        </div>
    );
}
