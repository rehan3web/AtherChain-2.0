import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Loader2, Smartphone, ShieldCheck, Fingerprint, Plus, Trash2, Laptop, Globe, Clock, LogOut, Copy, Check } from 'lucide-react';
import { Switch } from "@/components/ui/switch"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"

export function SecuritySection() {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<any[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // 2FA State
    const [is2FAEnabled, setIs2FAEnabled] = useState(user?.twofa_enabled || false);
    const [show2FADialog, setShow2FADialog] = useState(false);
    const [qrCode, setQrCode] = useState('');
    const [otp, setOtp] = useState('');
    const [secret, setSecret] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setLoadingSessions(true);
        try {
            const res = await api.get('/auth/sessions');
            setSessions(res.data.sessions);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        } finally {
            setLoadingSessions(false);
        }
    };

    const handleRemoveSession = async (sessionId: string) => {
        if (!confirm('Are you sure you want to log out this device?')) return;
        try {
            await api.delete(`/auth/sessions/${sessionId}`);
            toast.success('Session removed');
            fetchSessions();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to remove session');
        }
    };

    const handleRemoveAllSessions = async () => {
        if (!confirm('Are you sure you want to log out all other devices?')) return;
        try {
            await api.delete('/auth/sessions', { data: { excludeCurrent: true } });
            toast.success('All other sessions removed');
            fetchSessions();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to remove sessions');
        }
    };

    const handleEnable2FA = async () => {
        setLoading(true);
        try {
            const res = await api.post('/user/2fa/generate');
            setQrCode(res.data.qrCode);
            setSecret(res.data.secret);
            setShow2FADialog(true);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to generate 2FA');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyAndEnable2FA = async () => {
        if (!otp) return;
        setLoading(true);
        try {
            await api.post('/user/2fa/verify', { token: otp });
            toast.success('2FA Enabled Successfully');
            setShow2FADialog(false);
            setIs2FAEnabled(true);
            refreshUser();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Invalid OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleDisable2FA = async () => {
        const token = prompt('Enter your 2FA code to disable it:');
        if (!token) return;

        setLoading(true);
        try {
            await api.post('/user/2fa/disable', { token });
            toast.success('2FA Disabled Successfully');
            setIs2FAEnabled(false);
            refreshUser();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to disable 2FA');
        } finally {
            setLoading(false);
        }
    };

    const handleCopySecret = () => {
        navigator.clipboard.writeText(secret);
        setCopied(true);
        toast.success('2FA Secret copied');
        setTimeout(() => setCopied(false), 2000);
    };



    const toggle2FA = async (checked: boolean) => {
        if (checked) {
            await handleEnable2FA();
        } else {
            await handleDisable2FA();
        }
    };

    if (!user) return null;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Active Sessions Section */}
            <div className="p-6 border border-border rounded-lg bg-card/50 space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <h3 className="font-medium text-lg flex items-center gap-2">
                            <Laptop className="w-5 h-5 text-primary" />
                            Active Sessions
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            Manage devices where your account is currently logged in.
                        </p>
                    </div>
                    <Button variant="destructive" size="sm" onClick={handleRemoveAllSessions} disabled={loadingSessions}>
                        <LogOut className="w-4 h-4 mr-2" />
                        Log Out All Other Devices
                    </Button>
                </div>

                <div className="space-y-3">
                    {loadingSessions ? (
                        <div className="text-center py-4 text-muted-foreground">Loading sessions...</div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground">No active sessions found.</div>
                    ) : (
                        sessions.map((session) => (
                            <div key={session.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border border-border rounded-lg bg-background/30 group hover:border-primary/50 transition-colors gap-3">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                        {session.device.toLowerCase().includes('mobile') ? (
                                            <Smartphone className="w-5 h-5 text-primary" />
                                        ) : (
                                            <Laptop className="w-5 h-5 text-primary" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="font-medium text-sm flex items-center gap-2">
                                            {session.device}
                                            {session.isCurrent && (
                                                <Badge variant="secondary" className="text-[10px] h-5">Current Session</Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                                            <div className="flex items-center gap-1">
                                                <Globe className="w-3 h-3" />
                                                {session.ip}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                Active: {new Date(session.lastActive).toLocaleTimeString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {!session.isCurrent && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveSession(session.id)}
                                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                                    >
                                        Remove
                                    </Button>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* 2FA Section */}
            <div className="p-6 border border-border rounded-lg bg-card/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="font-medium text-lg flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-primary" />
                        Two-Factor Authentication (2FA)
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Secure your account using Google Authenticator or Authy.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Label htmlFor="2fa-toggle" className="text-sm font-medium">
                        {is2FAEnabled ? "Enabled" : "Disabled"}
                    </Label>
                    <Switch
                        id="2fa-toggle"
                        checked={is2FAEnabled}
                        onCheckedChange={toggle2FA}
                        disabled={loading}
                    />
                </div>
            </div>



            {/* Danger Zone: Account Deletion */}
            <div className="p-6 border border-destructive/30 rounded-lg bg-destructive/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="font-medium text-lg flex items-center gap-2 text-destructive">
                        <Trash2 className="w-5 h-5 text-destructive" />
                        Delete Account
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Permanently delete your account, balances, wallets, and all associated personal data.
                    </p>
                </div>
                <Button 
                    variant="destructive" 
                    onClick={() => window.location.href = '/delete-request'}
                    className="shrink-0 cursor-pointer"
                >
                    Request Deletion
                </Button>
            </div>

            {/* 2FA Setup Dialog */}
            <Dialog open={show2FADialog} onOpenChange={setShow2FADialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Enable Two-Factor Authentication</DialogTitle>
                        <DialogDescription>
                            Scan the QR code with your authenticator app, then enter the code below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col items-center gap-6 py-4">
                        {qrCode && (
                            <div className="flex flex-col items-center gap-4">
                                <div className="p-4 bg-white rounded-lg shadow-inner">
                                    <img src={qrCode} alt="2FA QR Code" className="w-48 h-48" />
                                </div>
                                <div className="text-center space-y-2 w-full">
                                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Manual Entry Key</p>
                                    <div className="flex items-center gap-2 p-3 bg-muted/50 border border-border rounded-md font-mono text-xs group relative">
                                        <span className="flex-1 text-center tracking-widest break-all whitespace-normal font-bold">{secret}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 hover:bg-primary/20 shrink-0 transition-all duration-200"
                                            onClick={handleCopySecret}
                                        >
                                            {copied ? (
                                                <Check className="h-3.5 w-3.5 text-green-500" />
                                            ) : (
                                                <Copy className="h-3.5 w-3.5 text-primary" />
                                            )}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        If you can't scan the QR code, enter this key manually in your app.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="w-full max-w-xs space-y-2">
                            <Label>Verification Code</Label>
                            <Input
                                placeholder="123456"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="text-center text-lg tracking-widest"
                                maxLength={6}
                            />
                        </div>

                        <Button onClick={handleVerifyAndEnable2FA} disabled={!otp || loading} className="w-full max-w-xs">
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Verify & Enable"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
