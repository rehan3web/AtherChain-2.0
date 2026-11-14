
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Paperclip, CheckCircle, Clock, Lock, AlertCircle, User, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import api from '@/lib/api';
import { format } from 'date-fns';
import { useSocket } from '@/hooks/use-socket';

export default function TicketDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { id } = params;

    const [ticket, setTicket] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const { socket, connected } = useSocket();

    useEffect(() => {
        fetchTicketDetails();
    }, [id]);

    useEffect(() => {
        if (socket && id) {
            socket.emit('join_ticket', id);

            socket.on('new_message', (message: any) => {
                setMessages((prev) => {
                    const exists = prev.some(m => m.id === message.id);
                    if (exists) return prev;
                    return [...prev, message];
                });
            });

            return () => {
                socket.emit('leave_ticket', id);
                socket.off('new_message');
            };
        }
    }, [socket, id]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchTicketDetails = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/support/${id}`);
            setTicket(res.data.ticket);
            setMessages(res.data.messages || []);
        } catch (error) {
            console.error('Failed to fetch ticket', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReply = async () => {
        if (!reply.trim()) return;

        try {
            setSending(true);
            const res = await api.post(`/support/${id}/reply`, { message: reply });
            // Optimistic update or refetch
            setReply('');
            // With WebSockets enabled, we don't strictly need to refetch everything,
            // but we might want to refetch the ticket status if it changed.
            const resDetails = await api.get(`/support/${id}`);
            setTicket(resDetails.data.ticket);
            // messages will be updated via socket
        } catch (error) {
            console.error('Failed to send reply', error);
        } finally {
            setSending(false);
        }
    };

    const getStatusBadge = (status: string) => {
        let color = 'bg-gray-500/10 text-gray-500';
        let icon = <Clock className="w-3 h-3 mr-1" />;

        switch (status) {
            case 'PENDING':
                color = 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                icon = <Clock className="w-3 h-3 mr-1" />;
                break;
            case 'OPEN':
                color = 'bg-blue-500/10 text-blue-500 border-blue-500/20';
                icon = <AlertCircle className="w-3 h-3 mr-1" />;
                break;
            case 'SOLVED':
                color = 'bg-green-500/10 text-green-500 border-green-500/20';
                icon = <CheckCircle className="w-3 h-3 mr-1" />;
                break;
            case 'CLOSED':
                color = 'bg-gray-500/10 text-gray-500 border-gray-500/20';
                icon = <Lock className="w-3 h-3 mr-1" />;
                break;
        }

        return (
            <Badge variant="outline" className={`${color} flex items-center rounded-none border-0 px-3 py-1 text-[10px] font-mono uppercase tracking-wider`}>
                {icon}
                {status}
            </Badge>
        );
    };

    if (loading) {
        return <div className="p-8 text-center">Loading ticket details...</div>;
    }

    if (!ticket) {
        return <div className="p-8 text-center text-destructive">Ticket not found</div>;
    }

    const isClosed = ['RESOLVED', 'REJECTED'].includes(ticket.status);

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col p-4 md:p-6 w-full mx-auto">
            {/* Receipt Header Style */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/support">
                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-none border-border bg-background hover:bg-secondary">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-lg font-bold tracking-tight uppercase font-mono">{ticket.title}</h1>
                            {getStatusBadge(ticket.status)}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
                            <span>ID: {ticket.id.slice(0, 8)}</span>
                            <span className="w-px h-3 bg-border" />
                            <span>INIT: {format(new Date(ticket.created_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Communication Log Area */}
            <div className="flex-1 flex flex-col border border-border bg-card relative overflow-hidden shadow-lg">
                {/* Background Texture */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

                {/* Log Header */}
                <div className="p-3 border-b border-border bg-muted/10 flex justify-between items-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <span>Secure_Communication_Log</span>
                    <span>Encrypted_AES_256</span>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex flex-col ${!msg.is_admin ? 'items-end' : 'items-start'} max-w-full`}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`text-[9px] font-mono uppercase tracking-wider ${msg.is_admin ? 'text-primary' : 'text-muted-foreground'}`}>
                                    {msg.is_admin ? '[SYSTEM_ADMIN]' : '[CLIENT_NODE]'}
                                </span>
                                <span className="text-[9px] font-mono text-muted-foreground/60">
                                    {format(new Date(msg.created_at), 'HH:mm:ss')}
                                </span>
                            </div>

                            <div
                                className={`p-4 max-w-[85%] font-mono text-xs border ${!msg.is_admin
                                    ? 'bg-foreground/5 border-foreground/20 text-foreground'
                                    : 'bg-primary/5 border-primary/20 text-foreground'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                {msg.image_url && (
                                    <div className="mt-3 border border-border bg-black/50 p-1">
                                        <a href={`${api.defaults.baseURL}/uploads/support/${msg.image_url}`} target="_blank" rel="noopener noreferrer">
                                            <img
                                                src={`${api.defaults.baseURL}/uploads/support/${msg.image_url}`}
                                                alt="Attachment"
                                                className="max-w-full h-auto opacity-90 hover:opacity-100 transition-opacity"
                                            />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-border bg-background/50 backdrop-blur-sm z-20">
                    {isClosed ? (
                        <div className="w-full p-4 bg-muted/10 border border-dashed border-border text-center">
                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                <Lock className="h-4 w-4" />
                                <span className="text-xs font-mono uppercase tracking-widest">Session_Terminated</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-0 border border-border focus-within:ring-1 focus-within:ring-foreground transition-all">
                            <div className="flex items-center pl-3 pr-2 bg-muted/10 border-r border-border">
                                <span className="text-xs font-mono text-muted-foreground animate-pulse">{'>'}</span>
                            </div>
                            <Textarea
                                placeholder="ENTER_TRANSMISSION..."
                                className="min-h-[50px] max-h-[150px] resize-none border-0 rounded-none bg-transparent focus-visible:ring-0 text-xs font-mono py-4"
                                value={reply}
                                onChange={(e) => setReply(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleReply();
                                    }
                                }}
                            />
                            <Button
                                className="h-auto w-[60px] shrink-0 rounded-none border-l border-border bg-foreground text-background hover:bg-foreground/90 uppercase text-[10px] font-bold tracking-widest"
                                onClick={handleReply}
                                disabled={!reply.trim() || sending}
                            >
                                {sending ? <Clock className="h-4 w-4 animate-spin" /> : 'SEND'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
