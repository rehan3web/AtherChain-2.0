'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Shield, User, MapPin, Calendar, FileText, CheckCircle, XCircle, Eye, EyeOff, Terminal, Fingerprint } from 'lucide-react';
import { useAlert } from '@/providers/AlertProvider';
import { getKycEvidence } from '@/services/kyc';

export default function KycDetailPage({ params }: { params: Promise<{ requestId: string }> }) {
    const { requestId } = use(params);
    const router = useRouter();
    const { showAlert } = useAlert();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    const fetchDetails = async () => {
        const token = localStorage.getItem('admin_token');
        try {
            const res = await api.get(`/admin/kyc/${requestId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData(res.data);
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Error fetching KYC details');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
    }, [requestId]);

    const handleDecision = async (status: 'approve' | 'reject') => {
        const token = localStorage.getItem('admin_token');
        let reason = '';
        if (status === 'reject') {
            reason = prompt('Rejection: Enter failure reason (MANDATORY):') || '';
            if (!reason) return showAlert('warning', 'Rejection requires a documented reason.');
        }

        if (!confirm(`Confirm ${status}?`)) return;

        setProcessing(true);
        try {
            await api.post(`/admin/kyc/${requestId}/${status}`, { reason }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showAlert('success', `Process complete: Identity ${status === 'approve' ? 'Approved' : 'Rejected'}`);
            router.push('/admin/kyc');
        } catch (error: any) {
            showAlert('danger', error.response?.data?.message || 'Action failed');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-primary font-mono text-xl animate-pulse tracking-[0.5em]">Loading...</div>
        </div>
    );

    if (!data) return <div className="p-20 text-center text-destructive font-mono">KYC request not found</div>;

    const { request, documents } = data;

    return (
        <div className="max-w-7xl mx-auto space-y-8 md:space-y-12 py-6 md:py-12 px-4 md:px-8 animate-in fade-in duration-1000">
            {/* Nav */}
            <div className="flex items-center gap-4 text-muted-foreground font-mono text-[10px] md:text-xs tracking-widest uppercase mb-8">
                <button
                    onClick={() => router.push('/admin/kyc')}
                    className="flex items-center gap-2 hover:text-foreground transition-colors group"
                >
                    <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
                    Back to Queue
                </button>
                <span className="hidden sm:inline">/</span>
                <span className="text-muted-foreground/60 hidden sm:inline">Review</span>
                <span>/</span>
                <span className="text-foreground truncate max-w-[150px]">{request.full_name}</span>
            </div>

            {/* Combined Inspection Terminal */}
            <div className="space-y-8 md:space-y-12">
                {/* 1. Identity & Context Card */}
                <div className="p-6 md:p-8 bg-card border border-border relative overflow-hidden group">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div className="space-y-6">
                            <div className="w-20 h-20 md:w-24 md:h-24 bg-secondary p-1 border border-border">
                                <div className="w-full h-full bg-background flex items-center justify-center border border-border">
                                    <Fingerprint size={40} className="text-foreground" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-foreground tracking-tighter uppercase leading-tight mb-1">
                                    {request.full_name}
                                </h1>
                                <p className="text-muted-foreground font-mono text-[10px] md:text-xs tracking-widest uppercase">{request.username}</p>
                            </div>
                        </div>

                        <div className="lg:col-span-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                <InfoItem icon={User} label="Father Name" value={request.father_name} />
                                <InfoItem icon={MapPin} label="Territory" value={request.country_code || request.country} />
                                <InfoItem icon={Calendar} label="DOB" value={request.dob ? new Date(request.dob).toLocaleDateString() : 'N/A'} />
                                <InfoItem icon={FileText} label="Preferred Language" value={request.language || 'English'} />
                                <InfoItem icon={Calendar} label="Submission" value={new Date(request.submitted_at).toLocaleString()} />
                                <InfoItem icon={Shield} label="ID Type" value={request.id_type} />
                                <InfoItem icon={FileText} label="ID Serial" value={request.id_number} />
                                <InfoItem icon={Shield} label="ID Expiry" value={request.id_expiry ? new Date(request.id_expiry).toLocaleDateString() : 'N/A'} />
                                <div className="space-y-3">
                                    <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Review method</div>
                                    <p className="text-sm font-semibold">Photo and document manual review</p>
                                    <p className="text-xs text-muted-foreground">A captured photo is not verified biometric liveness.</p>
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-border">
                                <h3 className="text-[10px] md:text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Residential Address</h3>
                                <p className="text-base font-mono text-foreground tracking-wide leading-relaxed">
                                    {request.address}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Evidence Assets (3 per line grid) */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between pb-4 border-b border-border">
                        <div className="flex items-center gap-4">
                            <div className="p-2 border border-border bg-secondary">
                                <Eye size={18} className="text-foreground" />
                            </div>
                            <h2 className="text-xl font-bold text-foreground uppercase tracking-widest">Evidence Terminal</h2>
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                            {documents.length + (request.face_scan_frame ? 1 : 0)} Review Images
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {request.face_scan_frame && (
                            <SecureImage key={`photo-${requestId}`} requestId={requestId} type="Live photo" date={request.submitted_at} />
                        )}
                        {documents.map((doc: any) => (
                            <SecureImage
                                key={doc.id}
                                docId={doc.id}
                                type={doc.document_type}
                                date={doc.created_at}
                            />
                        ))}
                    </div>
                </div>

                {/* 3. Decision Control Panel */}
                <div className="p-8 bg-card border border-border">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                        <div className="max-w-md space-y-2">
                            <h3 className="text-sm font-black text-foreground uppercase tracking-[0.3em] flex items-center gap-3">
                                <Terminal size={14} /> Decision Required
                            </h3>
                            <p className="text-[10px] font-mono text-muted-foreground leading-relaxed uppercase tracking-widest">
                                Authorization is irreversible. All decrypted identity assets will be purged upon decision confirmation.
                            </p>
                        </div>
                        <div className="flex items-center gap-4 w-full lg:flex-1">
                            <Button
                                className="flex-1 h-14 bg-foreground text-background hover:bg-foreground/90 font-bold uppercase tracking-widest text-[11px] rounded-none transition-all flex items-center justify-center shadow-lg shadow-foreground/5"
                                onClick={() => handleDecision('approve')}
                                disabled={processing || request.status !== 'pending'}
                            >
                                <CheckCircle size={18} className="shrink-0" />
                                <span className="ml-2">{request.status === 'approved' ? 'Identity Approved' : 'Approve'}</span>
                            </Button>
                            <Button
                                className="flex-1 h-14 bg-secondary text-foreground border border-border hover:bg-destructive hover:text-destructive-foreground hover:border-destructive font-bold uppercase tracking-widest text-[11px] rounded-none transition-all flex items-center justify-center"
                                onClick={() => handleDecision('reject')}
                                disabled={processing || request.status !== 'pending'}
                            >
                                <XCircle size={18} className="shrink-0" />
                                <span className="ml-2">{request.status === 'rejected' ? 'Denied' : 'Deny Access'}</span>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="p-2 bg-secondary border border-border text-foreground mt-1">
                <Icon size={14} />
            </div>
            <div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mb-1">{label}</div>
                <div className="text-xs font-mono text-foreground uppercase tracking-widest">{value}</div>
            </div>
        </div>
    );
}

function SecureImage({ docId, requestId, type, date }: { docId?: string, requestId?: string, type: string, date: string }) {
    const [src, setSrc] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        let active = true;
        let objectUrl = '';
        setSrc('');
        setError('');
        setLoading(true);
        const fetchImage = async () => {
            try {
                const blob = await getKycEvidence(requestId ? 'photo' : 'document', requestId || docId!, controller.signal);
                if (!active) return;
                objectUrl = URL.createObjectURL(blob);
                setSrc(objectUrl);
            } catch (cause) {
                if (!active) return;
                const failure = cause as { response?: { status?: number }; message?: string };
                setError(failure.response?.status === 404
                    ? 'Image unavailable or removed after KYC review.'
                    : 'Could not load this image from the backend. Please retry.');
            } finally {
                if (active) setLoading(false);
            }
        };
        void fetchImage();
        return () => {
            active = false;
            controller.abort();
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [docId, requestId, attempt]);

    return (
        <div className="group relative aspect-square bg-secondary border border-border p-1">
            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
                <div className="p-2 md:p-3 bg-secondary/80 backdrop-blur-sm border border-border text-foreground text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-colors group-hover:bg-foreground group-hover:text-background shadow-none">
                    {type.replace('_', ' ')}
                </div>
                <div className="w-10 h-10 bg-secondary/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground group-hover:bg-foreground group-hover:text-background transition-colors shadow-none">
                    <Fingerprint size={16} />
                </div>
            </div>

            {loading ? (
                <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-1 bg-border rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        />
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Loading...</div>
                </div>
            ) : src && !error ? (
                <img src={src} className="w-full h-full object-contain" alt={type}
                    onError={() => setError('The image could not be displayed. Please retry.')} />
            ) : (
                <div role="alert" className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 text-center text-sm">
                    <p>{error || 'Image unavailable'}</p>
                    <Button type="button" variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry image</Button>
                </div>
            )}

            <div className="absolute bottom-6 right-6 font-mono text-[9px] text-background/80 bg-foreground/20 px-2 py-1 rounded uppercase tracking-widest z-10">{new Date(date).toLocaleDateString()}</div>
        </div>
    );
}
