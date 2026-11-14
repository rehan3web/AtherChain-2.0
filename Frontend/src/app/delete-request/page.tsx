'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    AlertTriangle,
    ShieldAlert,
    Trash2,
    CheckCircle2,
    ArrowRight,
    ArrowLeft,
    Mail,
    Lock,
    RefreshCw,
    Clock,
    KeyRound,
    Eye,
    EyeOff,
    Loader2,
    User,
    Wallet,
    FileCheck,
    Pickaxe,
    History,
    Users,
    Smartphone,
    MessageSquare,
    Home,
} from 'lucide-react';

import api from '@/lib/api';
import logo from '@/assets/blackmode.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from '@/components/ui/input-otp';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Step = 1 | 2 | 3 | 4;

export default function DeleteRequestPage() {
    const router = useRouter();

    const [step, setStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Credentials
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Step 2: OTP Verification
    const [challengeId, setChallengeId] = useState('');
    const [maskedEmail, setMaskedEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [cooldown, setCooldown] = useState(60);
    const [canResend, setCanResend] = useState(false);
    const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

    // Step 3: Confirmation
    const [deletionToken, setDeletionToken] = useState('');
    const [confirmedChecked, setConfirmedChecked] = useState(false);

    // Cooldown timer for OTP resend
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (step === 2 && cooldown > 0) {
            timer = setInterval(() => {
                setCooldown((prev) => {
                    if (prev <= 1) {
                        setCanResend(true);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [step, cooldown]);

    // Handle Step 1: Request OTP
    const handleRequestOtp = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim() || !password) {
            toast.error('Please enter both email address and password');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/account-deletion/request-otp', {
                email: email.trim(),
                password,
            });

            if (res.data.success) {
                setChallengeId(res.data.challengeId);
                setMaskedEmail(res.data.maskedEmail || email);
                setOtp('');
                setCooldown(60);
                setCanResend(false);
                setRemainingAttempts(null);
                setStep(2);
                toast.success('Verification code sent to your registered email');
            } else {
                toast.error(res.data.message || 'Failed to initiate deletion request');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Invalid credentials or request failed';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // Handle Step 2: Resend OTP
    const handleResendOtp = async () => {
        if (!canResend || !challengeId || loading) return;

        setLoading(true);
        try {
            const res = await api.post('/account-deletion/resend-otp', {
                challengeId,
            });

            if (res.data.success) {
                setCooldown(60);
                setCanResend(false);
                setRemainingAttempts(null);
                setOtp('');
                toast.success('A new verification code has been dispatched to your email');
            } else {
                toast.error(res.data.message || 'Failed to resend code');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to resend verification code';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    // Handle Step 2: Verify OTP
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();

        if (otp.length !== 6) {
            toast.error('Please enter the complete 6-digit verification code');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/account-deletion/verify-otp', {
                challengeId,
                otp,
            });

            if (res.data.success && res.data.deletionAuthorizationToken) {
                setDeletionToken(res.data.deletionAuthorizationToken);
                setStep(3);
                toast.success('Identity verified. Please read the final warning.');
            } else {
                toast.error(res.data.message || 'Verification failed');
            }
        } catch (error: any) {
            const data = error.response?.data;
            const msg = data?.message || 'Verification failed';
            toast.error(msg);

            if (data?.remainingAttempts !== undefined) {
                setRemainingAttempts(data.remainingAttempts);
            }
            if (data?.expired) {
                setCanResend(true);
                setCooldown(0);
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle Cancel Deletion
    const handleCancelDeletion = async () => {
        try {
            await api.post('/account-deletion/cancel', {
                challengeId: challengeId || undefined,
                deletionAuthorizationToken: deletionToken || undefined,
            });
        } catch {
            // Ignore errors on cancel
        }

        toast.info('Account deletion request has been safely cancelled.');
        // Reset state back to Step 1
        setStep(1);
        setEmail('');
        setPassword('');
        setOtp('');
        setChallengeId('');
        setDeletionToken('');
        setConfirmedChecked(false);
    };

    // Handle Step 3: Final Confirm & Delete
    const handleConfirmDeletion = async () => {
        if (!confirmedChecked) {
            toast.error('You must check the confirmation checkbox to proceed');
            return;
        }

        if (!deletionToken) {
            toast.error('Deletion session expired. Please start over.');
            setStep(1);
            return;
        }

        setLoading(true);
        try {
            const res = await api.post('/account-deletion/confirm', {
                deletionAuthorizationToken: deletionToken,
                confirmationAccepted: true,
            });

            if (res.data.success) {
                // Clear any stored client tokens
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    localStorage.removeItem('admin_token');
                    sessionStorage.clear();
                }

                setStep(4);
                toast.success('Your account has been permanently deleted.');
            } else {
                toast.error(res.data.message || 'Failed to complete deletion');
            }
        } catch (error: any) {
            const msg = error.response?.data?.message || 'Failed to delete account';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col justify-between selection:bg-destructive/30">
            {/* Top Navigation Bar */}
            <header className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center p-1.5 transition-transform group-hover:scale-105">
                            <img src={logo.src} alt="AtherChain" className="w-full h-full object-contain" />
                        </div>
                        <span className="font-bold text-lg tracking-wider text-foreground">
                            ATHER<span className="text-primary font-normal text-xs ml-1 tracking-widest uppercase">Network</span>
                        </span>
                    </Link>

                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs px-2.5 py-1 text-muted-foreground border-border/60">
                            Public Portal
                        </Badge>
                        <Link href="/login">
                            <Button variant="ghost" size="sm" className="text-xs">
                                Return to Sign In
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center">
                {/* Step Indicator */}
                {step < 4 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                            <span className={step >= 1 ? 'text-primary font-semibold' : ''}>1. Credentials</span>
                            <span className={step >= 2 ? 'text-primary font-semibold' : ''}>2. Email OTP</span>
                            <span className={step >= 3 ? 'text-destructive font-semibold' : ''}>3. Final Warning</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${step >= 1 ? 'bg-primary' : 'bg-transparent'}`} />
                            <div className={`h-full transition-all duration-500 ${step >= 2 ? 'bg-primary' : 'bg-transparent'}`} />
                            <div className={`h-full transition-all duration-500 ${step >= 3 ? 'bg-destructive' : 'bg-transparent'}`} />
                        </div>
                    </div>
                )}

                <AnimatePresence mode="wait">
                    {/* STEP 1: CREDENTIALS */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                        >
                            <Card className="border-border/80 shadow-2xl bg-card/60 backdrop-blur-xl">
                                <CardHeader className="space-y-2 pb-4">
                                    <div className="w-12 h-12 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive flex items-center justify-center mb-1">
                                        <Trash2 className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-2xl font-bold tracking-tight">
                                        Account Deletion Request
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground text-sm leading-relaxed">
                                        This public self-service portal allows you to permanently delete your Ather Network account and all associated cryptographic, mining, and profile data.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-5">
                                    {/* Explanation Alert */}
                                    <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 flex gap-3.5 text-xs sm:text-sm text-foreground">
                                        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                                        <div className="space-y-1">
                                            <p className="font-semibold text-destructive">Irreversible Action</p>
                                            <p className="text-muted-foreground leading-normal">
                                                To protect account owners against unauthorized requests, you must authenticate with your account credentials and verify ownership via an email security code.
                                            </p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleRequestOtp} className="space-y-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Registered Email Address
                                            </Label>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    autoComplete="email"
                                                    placeholder="you@example.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="pl-9 h-11 bg-background/50 border-input"
                                                    required
                                                    disabled={loading}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Account Password
                                            </Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    id="password"
                                                    type={showPassword ? 'text' : 'password'}
                                                    autoComplete="current-password"
                                                    placeholder="••••••••••••"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    className="pl-9 pr-10 h-11 bg-background/50 border-input"
                                                    required
                                                    disabled={loading}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                                                    tabIndex={-1}
                                                >
                                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={loading || !email.trim() || !password}
                                            className="w-full h-11 font-semibold text-sm gap-2 mt-2"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Verifying Account...
                                                </>
                                            ) : (
                                                <>
                                                    Continue to Verification
                                                    <ArrowRight className="w-4 h-4" />
                                                </>
                                            )}
                                        </Button>
                                    </form>
                                </CardContent>

                                <CardFooter className="pt-2 border-t border-border/40 flex justify-center text-xs text-muted-foreground">
                                    <span>
                                        Changed your mind?{' '}
                                        <Link href="/login" className="text-primary hover:underline font-medium">
                                            Return to Sign In
                                        </Link>
                                    </span>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}

                    {/* STEP 2: OTP VERIFICATION */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                        >
                            <Card className="border-border/80 shadow-2xl bg-card/60 backdrop-blur-xl">
                                <CardHeader className="space-y-2 pb-4">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center mb-1">
                                        <KeyRound className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-2xl font-bold tracking-tight">
                                        Verify Email Security Code
                                    </CardTitle>
                                    <CardDescription className="text-muted-foreground text-sm">
                                        We sent a 6-digit confirmation code to{' '}
                                        <span className="font-semibold text-foreground">{maskedEmail}</span>. The code will expire in 5 minutes.
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="space-y-6">
                                    <form onSubmit={handleVerifyOtp} className="space-y-6">
                                        <div className="flex flex-col items-center justify-center space-y-3 py-2">
                                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Enter 6-Digit One-Time Password
                                            </Label>
                                            <InputOTP
                                                maxLength={6}
                                                value={otp}
                                                onChange={(value) => setOtp(value)}
                                                disabled={loading}
                                            >
                                                <InputOTPGroup className="gap-2 sm:gap-3">
                                                    <InputOTPSlot index={0} className="w-11 h-12 text-lg font-mono font-bold rounded-lg border-input" />
                                                    <InputOTPSlot index={1} className="w-11 h-12 text-lg font-mono font-bold rounded-lg border-input" />
                                                    <InputOTPSlot index={2} className="w-11 h-12 text-lg font-mono font-bold rounded-lg border-input" />
                                                    <InputOTPSlot index={3} className="w-11 h-12 text-lg font-mono font-bold rounded-lg border-input" />
                                                    <InputOTPSlot index={4} className="w-11 h-12 text-lg font-mono font-bold rounded-lg border-input" />
                                                    <InputOTPSlot index={5} className="w-11 h-12 text-lg font-mono font-bold rounded-lg border-input" />
                                                </InputOTPGroup>
                                            </InputOTP>

                                            {remainingAttempts !== null && (
                                                <p className="text-xs text-destructive font-medium">
                                                    {remainingAttempts} attempt(s) remaining before lock.
                                                </p>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                                <span>
                                                    {cooldown > 0 ? (
                                                        <>Resend available in <strong className="text-foreground">{cooldown}s</strong></>
                                                    ) : (
                                                        'Code expired or didn\'t arrive?'
                                                    )}
                                                </span>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                disabled={!canResend || loading}
                                                onClick={handleResendOtp}
                                                className="text-xs h-8 px-2.5 font-medium text-primary hover:text-primary/80 disabled:opacity-50"
                                            >
                                                <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                                                Resend Code
                                            </Button>
                                        </div>

                                        <div className="flex gap-3">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setStep(1)}
                                                disabled={loading}
                                                className="flex-1 h-11"
                                            >
                                                <ArrowLeft className="w-4 h-4 mr-2" />
                                                Back
                                            </Button>

                                            <Button
                                                type="submit"
                                                disabled={loading || otp.length !== 6}
                                                className="flex-1 h-11 font-semibold"
                                            >
                                                {loading ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                        Validating...
                                                    </>
                                                ) : (
                                                    'Verify Code'
                                                )}
                                            </Button>
                                        </div>
                                    </form>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* STEP 3: FINAL WARNING & CONFIRMATION */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                        >
                            <Card className="border-destructive/40 shadow-2xl bg-card/70 backdrop-blur-xl ring-1 ring-destructive/20">
                                <CardHeader className="space-y-3 pb-4">
                                    <div className="w-14 h-14 rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive flex items-center justify-center animate-pulse">
                                        <ShieldAlert className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-1">
                                        <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight text-destructive">
                                            Are you absolutely sure?
                                        </CardTitle>
                                        <CardDescription className="text-foreground/90 font-medium text-sm leading-relaxed">
                                            Deleting your account is permanent. Once your account is deleted, all associated account information and data will be permanently removed. This action cannot be undone.
                                        </CardDescription>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-5">
                                    {/* Data will be deleted list */}
                                    <div className="rounded-xl border border-border/80 bg-background/50 p-4 space-y-3">
                                        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            The following data will be permanently wiped:
                                        </p>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-foreground/90">
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span>User credentials & profile records</span>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                                <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span>AT/ATH wallet balances & Web3 vaults</span>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                                <FileCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span>KYC identity documents & selfies</span>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                                <Pickaxe className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span>Mining history, cycles & reward claims</span>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                                <History className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span>Complete transaction ledgers & logs</span>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span>Referral relationships & commission history</span>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                                <Smartphone className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span>Device fingerprints & active sessions</span>
                                            </div>
                                            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30">
                                                <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                                                <span>Support tickets & communication history</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Mandatory Checkbox */}
                                    <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5 cursor-pointer select-none">
                                        <Checkbox
                                            id="confirm-delete"
                                            checked={confirmedChecked}
                                            onCheckedChange={(checked) => setConfirmedChecked(checked === true)}
                                            className="mt-0.5 border-destructive data-[state=checked]:bg-destructive data-[state=checked]:text-destructive-foreground"
                                        />
                                        <label
                                            htmlFor="confirm-delete"
                                            className="text-xs sm:text-sm font-semibold text-foreground leading-snug cursor-pointer"
                                        >
                                            I understand that all my account data will be permanently deleted and this action cannot be undone.
                                        </label>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleCancelDeletion}
                                            disabled={loading}
                                            className="flex-1 h-11"
                                        >
                                            Cancel Deletion
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="destructive"
                                            disabled={!confirmedChecked || loading}
                                            onClick={handleConfirmDeletion}
                                            className="flex-1 h-11 font-bold shadow-lg shadow-destructive/20"
                                        >
                                            {loading ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    Deleting Account...
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                    Permanently Delete My Account
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    )}

                    {/* STEP 4: SUCCESS CONFIRMATION */}
                    {step === 4 && (
                        <motion.div
                            key="step4"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Card className="border-border/80 shadow-2xl bg-card/60 backdrop-blur-xl text-center">
                                <CardHeader className="space-y-4 pb-4 items-center">
                                    <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 flex items-center justify-center">
                                        <CheckCircle2 className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-2">
                                        <CardTitle className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                                            Your account has been permanently deleted.
                                        </CardTitle>
                                        <CardDescription className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                                            All eligible account data associated with your account has been removed successfully. All active sessions, authentication tokens, and cryptographic keys have been invalidated.
                                        </CardDescription>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <div className="p-4 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground max-w-md mx-auto">
                                        Thank you for having been part of the Ather Network. If you ever decide to return, you are welcome to register a new account at any time.
                                    </div>
                                </CardContent>

                                <CardFooter className="flex justify-center pb-8 pt-2">
                                    <Link href="/login">
                                        <Button className="h-11 px-8 gap-2 font-semibold">
                                            <Home className="w-4 h-4" />
                                            Return to Home
                                        </Button>
                                    </Link>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Footer */}
            <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
                <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p>© {new Date().getFullYear()} Ather Network. All rights reserved.</p>
                    <div className="flex items-center gap-4">
                        <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
                        <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
                        <Link href="/help" className="hover:text-foreground transition-colors">Support</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

