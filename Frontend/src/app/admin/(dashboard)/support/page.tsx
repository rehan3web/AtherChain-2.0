'use client';

import { useEffect, useState } from 'react';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function SupportTicketsPage() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [pagination, setPagination] = useState({ page: 1, pages: 1 });

    const fetchTickets = async (page = 1) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('admin_token');
            const res = await api.get(`/support/admin/list?status=${statusFilter}&page=${page}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTickets(res.data.tickets);
            setPagination(res.data.pagination);
        } catch (error) {
            console.error('Failed to fetch tickets:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTickets();
    }, [statusFilter]);

    return (
        <div className="space-y-8 w-full animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-2xl font-black uppercase tracking-widest text-foreground">Support Queue</h1>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Help Desk & Ticketing</p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                <div className="flex flex-1 gap-4">
                    <div className="p-4 bg-secondary border border-border flex items-center justify-between flex-1">
                        <div>
                            <div className="text-muted-foreground text-[10px] font-mono uppercase tracking-widest mb-1">Open Tickets</div>
                            <div className="text-2xl font-black text-foreground">
                                {tickets.filter((t: any) => t.status === 'OPEN').length}
                            </div>
                        </div>
                        <div className="w-10 h-10 bg-background border border-border flex items-center justify-center">
                            <Clock className="text-foreground" size={18} />
                        </div>
                    </div>
                    <div className="hidden md:flex p-4 bg-secondary border border-border items-center justify-between flex-1">
                        <div>
                            <div className="text-muted-foreground text-[10px] font-mono uppercase tracking-widest mb-1">Resolved</div>
                            <div className="text-2xl font-black text-foreground">
                                {tickets.filter((t: any) => t.status === 'RESOLVED').length}
                            </div>
                        </div>
                        <div className="w-10 h-10 bg-background border border-border flex items-center justify-center">
                            <CheckCircle2 className="text-foreground" size={18} />
                        </div>
                    </div>
                </div>

                <div className="flex bg-secondary/30 p-1 border border-border w-full lg:w-auto overflow-x-auto no-scrollbar">
                    {['', 'OPEN', 'RESOLVED', 'REJECTED'].map((s) => (
                        <button
                            key={s}
                            onClick={() => { setStatusFilter(s); fetchTickets(1); }}
                            className={`px-6 py-3 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors whitespace-nowrap flex-1 lg:flex-none ${statusFilter === s
                                ? 'bg-foreground text-background shadow-none border border-foreground'
                                : 'text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent'
                                }`}
                        >
                            {s === '' ? 'ALL' : s}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tickets Content */}
            <div className="space-y-6">
                {/* Desktop Table */}
                <div className="hidden @[48rem]/main:block border border-border bg-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-border bg-secondary/50">
                                    <th className="px-6 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground">User</th>
                                    <th className="px-6 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground">Status/Type</th>
                                    <th className="px-6 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground">Message</th>
                                    <th className="px-6 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground">Date</th>
                                    <th className="px-6 py-4 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-muted-foreground text-right border-l border-border/20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/30">
                                {loading ? (
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={5} className="px-6 py-6 h-16 bg-secondary/10" />
                                        </tr>
                                    ))
                                ) : tickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-20 text-center border-dashed border-t border-border/50 bg-secondary/10">
                                            <div className="text-muted-foreground font-mono text-sm tracking-[0.5em] uppercase">No support tickets found</div>
                                        </td>
                                    </tr>
                                ) : (
                                    tickets.map((ticket: any) => {
                                        const isClosed = ['RESOLVED', 'REJECTED'].includes(ticket.status);
                                        return (
                                            <tr key={ticket.id} className={`hover:bg-secondary/20 transition-colors ${isClosed ? 'opacity-50' : 'cursor-pointer group'}`}>
                                                <td className="px-6 py-4 align-top">
                                                    <div className={`text-xs font-bold uppercase tracking-widest text-foreground mb-1 ${!isClosed && 'group-hover:text-foreground transition-colors'}`}>{ticket.name}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.2em]">@{ticket.username}</div>
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                    <p className="text-xs text-muted-foreground font-mono line-clamp-2 max-w-sm">{ticket.message}</p>
                                                </td>
                                                <td className="px-6 py-4 align-top whitespace-nowrap">
                                                    <div className="text-[10px] font-mono font-bold text-foreground tracking-widest uppercase">{new Date(ticket.created_at).toLocaleDateString()}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono uppercase mt-1">{new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                </td>
                                                <td className="px-6 py-4 align-top">
                                                    <div className="flex flex-col gap-2">
                                                        <span className={`px-3 py-1 text-[9px] font-bold tracking-[0.2em] uppercase border w-fit ${ticket.status === 'OPEN' ? 'bg-secondary text-foreground border-border' :
                                                            ticket.status === 'RESOLVED' ? 'bg-secondary/50 text-muted-foreground border-transparent' :
                                                                'bg-destructive/10 text-destructive border-destructive/30'
                                                            }`}>
                                                            {ticket.status}
                                                        </span>
                                                        {ticket.is_user_blocked && (
                                                            <span className="px-3 py-1 text-[9px] font-bold tracking-[0.2em] uppercase bg-red-500/10 text-red-500 border border-red-500/30 w-fit">
                                                                BLOCKED USER
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 align-top text-right border-l border-border/20">
                                                    {isClosed ? (
                                                        <Button size="sm" variant="outline" className="rounded-none border-border bg-transparent disabled:opacity-50 font-bold text-[10px] uppercase h-8" disabled>
                                                            Archived
                                                        </Button>
                                                    ) : (
                                                        <Link href={`/admin/support/${ticket.id}`}>
                                                            <Button size="sm" variant="outline" className="rounded-none bg-background hover:bg-foreground hover:text-background border-border font-bold text-[10px] uppercase tracking-widest h-8 transition-colors">
                                                                Attend
                                                            </Button>
                                                        </Link>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Cards */}
                <div className="block @[48rem]/main:hidden space-y-4">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="h-40 animate-pulse bg-secondary/20 border border-border" />
                        ))
                    ) : tickets.length === 0 ? (
                        <div className="py-20 text-center border border-dashed border-border/50 bg-secondary/10">
                            <div className="text-muted-foreground font-mono text-xs tracking-[0.3em] uppercase">No support tickets found</div>
                        </div>
                    ) : (
                        tickets.map((ticket: any) => {
                            const isClosed = ['RESOLVED', 'REJECTED'].includes(ticket.status);
                            return (
                                <div key={ticket.id} className={`p-6 bg-card border border-border flex flex-col justify-between ${isClosed ? 'opacity-60' : ''}`}>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1">
                                            <div className="text-sm font-bold uppercase tracking-widest text-foreground">{ticket.name}</div>
                                            <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.2em]">@{ticket.username}</div>
                                        </div>
                                        <span className={`px-3 py-1 text-[9px] font-bold tracking-[0.2em] uppercase border ${ticket.status === 'OPEN' ? 'bg-secondary text-foreground border-border' :
                                            ticket.status === 'RESOLVED' ? 'bg-secondary/50 text-muted-foreground border-transparent' :
                                                'bg-destructive/10 text-destructive border-destructive/30'
                                            }`}>
                                            {ticket.status}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono line-clamp-3 mb-4 pl-3 border-l hover:border-foreground border-border transition-colors">{ticket.message}</p>
                                    <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                                        <div className="text-[10px] text-muted-foreground font-mono uppercase">
                                            {new Date(ticket.created_at).toLocaleDateString()} <span className="opacity-30">/</span> {new Date(ticket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {isClosed ? (
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase px-4 py-2 border border-border bg-secondary/50">Archived</span>
                                        ) : (
                                            <Link href={`/admin/support/${ticket.id}`} className="w-1/3">
                                                <Button size="sm" variant="outline" className="w-full rounded-none border-border hover:bg-foreground hover:text-background font-bold uppercase tracking-widest h-9 transition-colors">
                                                    Attend
                                                </Button>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div className="flex justify-center items-center gap-2 pt-6 pb-10">
                        {Array.from({ length: pagination.pages }).map((_, i) => (
                            <Button
                                key={i}
                                variant="outline"
                                onClick={() => fetchTickets(i + 1)}
                                className={`w-10 h-10 rounded-none font-mono font-bold transition-colors ${pagination.page === i + 1
                                    ? 'bg-foreground text-background border-foreground'
                                    : 'border-border bg-background hover:bg-secondary text-muted-foreground'
                                    }`}
                            >
                                {i + 1}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
