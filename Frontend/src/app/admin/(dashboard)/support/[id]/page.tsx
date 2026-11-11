'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, User, Send, CheckCircle2, XCircle, Loader2, Paperclip, Shield } from 'lucide-react';
import api from '@/lib/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { useAlert } from '@/providers/AlertProvider';
import { useSocket } from '@/hooks/use-socket';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function TicketDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [ticket, setTicket] = useState<any>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [reply, setReply] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const { showAlert } = useAlert();

    // Confirmation Dialog State
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [pendingStatus, setPendingStatus] = useState<'RESOLVED' | 'REJECTED' | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const backendURL = api.defaults.baseURL;
    const { socket } = useSocket();

    const fetchTicket = async () => {
        try {
            const token = localStorage.getItem('admin_token');
            const res = await api.get(`/support/admin/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTicket(res.data.ticket);
            setMessages(res.data.messages || []);
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Failed to fetch ticket details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) fetchTicket();
    }, [id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

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

    const handleReply = async () => {
        if (!reply.trim() && !file) return;

        setSubmitting(true);
        const formData = new FormData();
        formData.append('message', reply);
        if (file) {
            formData.append('image', file);
        }

        try {
            const token = localStorage.getItem('admin_token');
            // Admin can reply regardless of status, loops back to OPEN if needed or stays same
            await api.post(`/support/admin/${id}/reply`, formData, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });
            setReply('');
            setFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            // No need to refetch all messages, socket will handle it.
            // But we might want to refetch the ticket status.
            const tokenRes = localStorage.getItem('admin_token');
            const resDetails = await api.get(`/support/admin/${id}`, {
                headers: { Authorization: `Bearer ${tokenRes}` }
            });
            setTicket(resDetails.data.ticket);
            showAlert('success', 'Reply sent successfully');
        } catch (error) {
            showAlert('danger', 'Failed to send reply');
        } finally {
            setSubmitting(false);
        }
    };

    const initiateStatusChange = (status: 'RESOLVED' | 'REJECTED') => {
        setPendingStatus(status);
        setConfirmOpen(true);
    };

    const confirmStatusChange = async () => {
        if (!pendingStatus) return;

        setSubmitting(true);
        try {
            const token = localStorage.getItem('admin_token');
            // We can reuse the reply endpoint with status update, or just send a status update
            // The reply endpoint supports status change.
            await api.post(`/support/admin/${id}/reply`, { status: pendingStatus }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchTicket();
            showAlert('success', `Ticket marked as ${pendingStatus}`);
        } catch (error) {
            showAlert('danger', 'Failed to update status');
        } finally {
            setSubmitting(false);
            setConfirmOpen(false);
            setPendingStatus(null);
        }
    };

    const safeFormatDate = (dateString: any, formatStr: string) => {
        if (!dateString) return 'N/A';
        try {
            return format(new Date(dateString), formatStr);
        } catch (e) {
            return 'Invalid Date';
        }
    };

    if (loading) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin inline mr-2" /> Loading...</div>;
    if (!ticket) return <div className="p-8 text-center">Ticket not found.</div>;

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border pb-4 shrink-0">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => router.push('/admin/support')} className="md:hidden rounded-none border-border">
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl font-black uppercase tracking-widest text-foreground">{ticket.title || 'Support Request'}</h1>
                            <span className={`px-3 py-1 text-[9px] font-bold tracking-[0.2em] uppercase border ${ticket.status === 'OPEN' ? 'bg-secondary text-foreground border-border' :
                                ticket.status === 'RESOLVED' ? 'bg-secondary/50 text-muted-foreground border-transparent' :
                                    'bg-destructive/10 text-destructive border-destructive/30'
                                }`}>
                                {ticket.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-2 font-mono uppercase tracking-widest">
                            <span>#{ticket?.id ? String(ticket.id).slice(0, 8) : 'N/A'}</span>
                            <span>/</span>
                            <span className="flex items-center gap-1 font-bold text-foreground">@{ticket?.username || 'unknown'}</span>
                            <span>/</span>
                            <span>{safeFormatDate(ticket?.created_at, 'PPP p')}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {ticket.status === 'OPEN' || ticket.status === 'PENDING' ? (
                        <>
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-border rounded-none text-[10px] font-bold uppercase tracking-widest hover:bg-foreground hover:text-background transition-colors h-10 px-6"
                                onClick={() => initiateStatusChange('RESOLVED')}
                                disabled={submitting}
                            >
                                <CheckCircle2 size={16} className="mr-2" /> Resolve
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="border-border rounded-none text-[10px] font-bold uppercase tracking-widest hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors h-10 px-6"
                                onClick={() => initiateStatusChange('REJECTED')}
                                disabled={submitting}
                            >
                                <XCircle size={16} className="mr-2" /> Reject
                            </Button>
                        </>
                    ) : (
                        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground bg-secondary px-4 py-2 border border-border">
                            Archive State: {ticket.status}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-hidden">
                {/* Chat Section */}
                <div className="md:col-span-2 flex flex-col border border-border bg-card overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="flex justify-center mb-8">
                            <span className="text-[9px] font-mono border border-border bg-secondary text-muted-foreground uppercase tracking-[0.2em] px-4 py-1.5">
                                Log Started: {safeFormatDate(ticket.created_at, 'PPP')}
                            </span>
                        </div>

                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-4 ${msg.is_admin ? 'justify-end' : 'justify-start'}`}>
                                {!msg.is_admin && (
                                    <div className="h-8 w-8 bg-secondary border border-border flex items-center justify-center shrink-0">
                                        <User size={14} className="text-foreground" />
                                    </div>
                                )}

                                <div className={`flex flex-col max-w-[80%] ${msg.is_admin ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${msg.is_admin ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {msg.is_admin ? 'Syst Admin' : `@${ticket.username || 'user'}`}
                                        </span>
                                        <span className="text-[9px] font-mono text-muted-foreground/60">
                                            {safeFormatDate(msg.created_at, 'HH:mm:ss')}
                                        </span>
                                    </div>
                                    <div className={`p-4 text-sm font-mono leading-relaxed transition-colors ${msg.is_admin
                                        ? 'bg-foreground text-background border border-foreground'
                                        : 'bg-secondary text-foreground border border-border'
                                        }`}>
                                        <p className="whitespace-pre-wrap tracking-tight">{msg.message}</p>
                                        {msg.image_url && (
                                            <div className="mt-4 border border-border overflow-hidden bg-background">
                                                <a href={`${backendURL}/uploads/support/${msg.image_url.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer">
                                                    <img
                                                        src={`${backendURL}/uploads/support/${msg.image_url.replace(/\\/g, '/')}`}
                                                        alt="Attachment"
                                                        className="max-w-full h-auto max-h-[300px] object-cover hover:opacity-90 transition-opacity"
                                                    />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {msg.is_admin && (
                                    <div className="h-8 w-8 bg-foreground flex items-center justify-center shrink-0 text-background">
                                        <Shield size={14} />
                                    </div>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Reply Area */}
                    <div className="p-4 bg-secondary/30 border-t border-border shrink-0">
                        <div className="w-full space-y-3">
                            {file && (
                                <div className="flex items-center gap-3 text-[10px] font-mono font-bold uppercase tracking-widest text-foreground bg-background px-4 py-2 border border-border w-fit">
                                    <Paperclip size={14} className="text-muted-foreground" />
                                    <span className="truncate max-w-[200px]">{file.name}</span>

                                    <button onClick={() => setFile(null)} className="hover:text-destructive transition-colors"><XCircle size={14} /></button>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0 h-[50px] w-[50px] rounded-none border border-border text-muted-foreground hover:text-foreground hover:border-foreground hover:bg-secondary transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Paperclip size={20} />
                                </Button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                                />

                                <Textarea
                                    placeholder="TYPE YOUR REPLY..."
                                    className="min-h-[50px] max-h-[150px] resize-none border-border rounded-none bg-background focus-visible:ring-1 focus-visible:ring-foreground font-mono text-xs uppercase"
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
                                    className="h-[50px] w-[50px] shrink-0 rounded-none bg-foreground text-background hover:bg-foreground/90 border border-foreground"
                                    onClick={handleReply}
                                    disabled={submitting || (!reply.trim() && !file)}
                                >
                                    {submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                </Button>
                            </div>
                            <div className="text-[9px] text-muted-foreground font-mono uppercase tracking-[0.2em] flex justify-between px-1">
                                <span>Admins can reply even if ticket is closed.</span>
                                <span>Press Enter to send, Shift+Enter for new line</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6 overflow-y-auto">
                    <div className="p-6 border border-border bg-card">
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-6">User Details</h4>
                        <div className="space-y-6">
                            <div className="flex items-center gap-4 border border-border p-4 bg-secondary/20">
                                <div className="h-12 w-12 border border-border bg-background flex flex-col items-center justify-center font-bold text-lg text-foreground uppercase">
                                    {ticket.username ? ticket.username[0] : 'U'}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-bold text-foreground uppercase tracking-widest truncate">{ticket.name}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.2em] truncate">@{ticket.username}</div>
                                </div>
                            </div>
                            <div className="space-y-4 pt-2">
                                <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
                                    <span className="text-muted-foreground uppercase tracking-[0.2em] font-bold text-[9px]">Email</span>
                                    <span className="font-mono text-foreground text-xs truncate">{ticket.email}</span>
                                </div>
                                <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
                                    <span className="text-muted-foreground uppercase tracking-[0.2em] font-bold text-[9px]">Title</span>
                                    <span className="font-bold text-foreground text-xs uppercase">{ticket.title}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 border border-border bg-card flex flex-col h-[calc(100%-350px)] min-h-[300px]">
                        <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4 shrink-0">Original Message</h4>
                        <div className="text-xs font-mono text-foreground/80 leading-relaxed overflow-y-auto pr-2 custom-scrollbar p-4 bg-secondary/20 border border-border flex-1">
                            {ticket.message}
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Change Confirmation Dialog */}
            <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                <DialogContent className="rounded-none border-border bg-background sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black uppercase tracking-widest">Confirm Action</DialogTitle>
                        <DialogDescription className="text-xs font-mono text-muted-foreground uppercase leading-relaxed mt-4">
                            Are you sure you want to mark this ticket as <span className="font-bold text-foreground">[{pendingStatus}]</span>?
                            {pendingStatus === 'RESOLVED' && " This indicates the issue has been successfully handled."}
                            {pendingStatus === 'REJECTED' && " This indicates the request was invalid or denied."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-8 gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setConfirmOpen(false)} className="rounded-none border-border text-[10px] font-bold uppercase tracking-widest hover:bg-secondary transition-colors">Cancel</Button>
                        <Button
                            variant={pendingStatus === 'REJECTED' ? 'destructive' : 'default'}
                            onClick={confirmStatusChange}
                            disabled={submitting}
                            className={`rounded-none text-[10px] font-bold uppercase tracking-widest transition-colors ${pendingStatus === 'REJECTED' ? 'hover:bg-destructive/90' : 'hover:bg-foreground/90'}`}
                        >
                            {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                            Confirm {pendingStatus}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
