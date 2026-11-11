
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, MessageSquare, Clock, CheckCircle, XCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import api from '@/lib/api';
import { format } from 'date-fns';

export default function SupportPage() {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchTickets();
    }, []);

    const fetchTickets = async () => {
        try {
            setLoading(true);
            const res = await api.get('/support');
            setTickets(res.data.tickets || []);
        } catch (error) {
            console.error('Failed to fetch tickets', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
            case 'OPEN': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
            case 'RESOLVED': return 'bg-green-500/10 text-green-500 opacity-60';
            case 'REJECTED': return 'bg-destructive/10 text-destructive opacity-60';
            case 'CLOSED': return 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20';
            default: return 'bg-gray-500/10 text-gray-500';
        }
    };

    const filteredTickets = tickets.filter(ticket =>
        ticket.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.id.includes(searchTerm)
    );

    return (
        <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-start p-6 relative space-y-8">
            <div className="w-full max-w-5xl mx-auto z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-2xl font-light tracking-tight uppercase">Support Ledger</h1>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">Ticket Management System</p>
                    </div>
                    <Link href="/dashboard/support/new">
                        <Button className="bg-foreground text-background hover:opacity-90 rounded-none uppercase tracking-widest text-xs font-bold px-6 h-10">
                            <Plus className="mr-2 h-4 w-4" /> Open Ticket
                        </Button>
                    </Link>
                </div>

                <div className="bg-card border border-border relative overflow-hidden">
                    {/* Background Texture */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                    {/* Search Bar */}
                    <div className="p-4 border-b border-border bg-background/50 backdrop-blur-sm">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="SEARCH_TICKETS_ID_OR_TITLE..."
                                className="pl-10 h-10 bg-transparent border-border rounded-none font-mono text-xs uppercase focus-visible:ring-0 focus-visible:border-foreground"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Table Header */}
                    <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/20 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                        <div className="col-span-2">Ticket_ID</div>
                        <div className="col-span-5">Subject</div>
                        <div className="col-span-2 text-center">Status</div>
                        <div className="col-span-3 text-right">Last_Update</div>
                    </div>

                    {/* Table Content */}
                    <div className="divide-y divide-border">
                        {loading ? (
                            <div className="p-12 flex flex-col items-center justify-center gap-4">
                                <Clock className="h-8 w-8 animate-spin text-muted-foreground" />
                                <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading_Ledger_Data...</p>
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground">
                                <MessageSquare className="mx-auto h-12 w-12 opacity-20 mb-4" />
                                <p className="text-xs font-mono uppercase tracking-widest">No_Entries_Found</p>
                            </div>
                        ) : (
                            filteredTickets.map((ticket: any) => {
                                const isClosed = ['RESOLVED', 'REJECTED'].includes(ticket.status);
                                const content = (
                                    <div className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center ${isClosed ? 'opacity-50 cursor-not-allowed' : 'group-hover:bg-muted/30'}`}>
                                        <div className="col-span-2 font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                                            #{ticket.id.slice(0, 8)}
                                        </div>
                                        <div className="col-span-5">
                                            <h3 className="text-sm font-medium text-foreground group-hover:text-primary transition-colors font-mono uppercase truncate">
                                                {ticket.title || 'Support Request'}
                                            </h3>
                                        </div>
                                        <div className="col-span-2 flex justify-start md:justify-center">
                                            <Badge variant="outline" className={`rounded-none border-0 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </Badge>
                                        </div>
                                        <div className="col-span-3 text-left md:text-right font-mono text-[10px] text-muted-foreground">
                                            {format(new Date(ticket.updated_at), 'yyyy-MM-dd HH:mm:ss')}
                                        </div>
                                    </div>
                                );

                                if (isClosed) {
                                    return <div key={ticket.id}>{content}</div>;
                                }

                                return (
                                    <Link key={ticket.id} href={`/dashboard/support/${ticket.id}`} className="block group transition-colors">
                                        {content}
                                    </Link>
                                );
                            })
                        )}
                    </div>

                    {/* Footer / Status Bar */}
                    <div className="p-2 border-t border-border bg-muted/10 flex justify-between items-center text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                        <span>Total_Entries: {filteredTickets.length}</span>
                        <span>System_Status: ONLINE</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
