"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import api from "@/lib/api"
import { useAuth } from "@/providers/AuthProvider"
import { useAlert } from "@/providers/AlertProvider"
import { Loader2, Fingerprint } from "lucide-react"

import { useEffect } from "react"
import { QRCodeSVG } from 'qrcode.react'
import { io } from 'socket.io-client'
import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Laptop, Globe, Clock, Smartphone } from "lucide-react"

const loginSchema = z.object({
    emailOrUsername: z.string().min(1, "Email or Username is required"),
    password: z.string().min(1, "Password is required"),
})

export function LoginForm() {
    const router = useRouter()
    const { refreshUser } = useAuth()
    const { showAlert } = useAlert()
    const searchParams = useSearchParams()
    const registered = searchParams.get('registered')
    const [loading, setLoading] = useState(false)

    const [require2FA, setRequire2FA] = useState(false)
    const [requireEmailVerification, setRequireEmailVerification] = useState(false)
    const [userId, setUserId] = useState('')
    const [otp, setOtp] = useState('')
    const [showSessionLimitModal, setShowSessionLimitModal] = useState(false)
    const [activeSessions, setActiveSessions] = useState<any[]>([])
    const [sessionMgmtToken, setSessionMgmtToken] = useState('')

    // 2FA Recovery State
    const [recoveryStep, setRecoveryStep] = useState<'none' | 'confirm' | 'otp'>('none')
    const [maskedEmail, setMaskedEmail] = useState('')
    const [recoveryOtp, setRecoveryOtp] = useState('')
    const [countdown, setCountdown] = useState(0)

    // QR Login State
    const [qrToken, setQrToken] = useState('')
    const [qrSessionId, setQrSessionId] = useState('')
    const [showQrModal, setShowQrModal] = useState(false)
    const [qrCountdown, setQrCountdown] = useState(0)

    useEffect(() => {
        if (!showQrModal || !qrSessionId) return

        const socketURL = process.env.NEXT_PUBLIC_API_URL || 'https://api.atherchain.com'
        // If API URL ends with /api, remove it for socket connection
        const baseURL = socketURL.replace(/\/api$/, '')
        
        const socket = io(baseURL, {
            transports: ['websocket', 'polling']
        })

        socket.on('connect', () => {
            console.log('Socket connected for QR login')
        })

        socket.on(`qr_login_approved_${qrSessionId}`, async (data: any) => {
            if (data.success && data.token) {
                setShowQrModal(false)
                localStorage.setItem('token', data.token)
                await refreshUser()
                showAlert('success', 'App login successful')
                router.push('/dashboard')
            }
        })

        return () => {
            socket.disconnect()
        }
    }, [showQrModal, qrSessionId, refreshUser, router, showAlert])

    useEffect(() => {
        if (!showQrModal || qrCountdown <= 0) return
        const timer = setInterval(() => {
            setQrCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    setShowQrModal(false)
                    showAlert('warning', 'QR Code expired. Please try again.')
                    return 0
                }
                return prev - 1
            })
        }, 1000)
        return () => clearInterval(timer)
    }, [showQrModal, qrCountdown, showAlert])

    async function handleRemoveSession(sessionId: string) {
        if (!confirm('Are you sure you want to log out this device?')) return
        try {
            await api.delete(`/auth/sessions/${sessionId}`, {
                headers: { Authorization: `Bearer ${sessionMgmtToken}` }
            })
            showAlert('success', 'Session removed')

            // Remove from local list
            const updatedSessions = activeSessions.filter(s => s.id !== sessionId)
            setActiveSessions(updatedSessions)

            if (updatedSessions.length < 2) {
                setShowSessionLimitModal(false)
                setSessionMgmtToken('')
                showAlert('success', 'Session limit resolved. Please login again.')
            }
        } catch (error: any) {
            showAlert('error', error.response?.data?.message || 'Failed to remove session')
        }
    }

    async function handleAppLogin() {
        setLoading(true)
        try {
            const res = await api.post('/auth/qr/create')
            setQrToken(res.data.qrToken)
            setQrSessionId(res.data.sessionId)
            setShowQrModal(true)
            setQrCountdown(120)
        } catch (error: any) {
            console.error('App Login Error:', error)
            showAlert('error', error.response?.data?.message || 'Failed to generate QR login')
        } finally {
            setLoading(false)
        }
    }

    const form = useForm<z.infer<typeof loginSchema>>({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            emailOrUsername: "",
            password: "",
        },
    })

    async function handleVerify() {
        if (!otp) return
        setLoading(true)
        try {
            let res;
            if (requireEmailVerification) {
                res = await api.post('/auth/verify-suspicious-login', { userId, otp })
            } else {
                res = await api.post('/auth/verify-2fa-login', { userId, token: otp })
            }

            // Check for session limit from verify response
            if (res.data.code === 'SESSION_LIMIT_EXCEEDED') {
                setActiveSessions(res.data.sessions)
                setSessionMgmtToken(res.data.sessionManagementToken)
                setShowSessionLimitModal(true)
                setRequireEmailVerification(false) // Hide OTP form to show modal
                setRequire2FA(false)
                return
            }

            localStorage.setItem('token', res.data.token)
            await refreshUser()
            showAlert('success', 'Login successful')
            router.push('/dashboard')
        } catch (err: any) {
            if (err.response?.data?.code === 'SESSION_LIMIT_EXCEEDED') {
                setActiveSessions(err.response.data.sessions)
                setSessionMgmtToken(err.response.data.sessionManagementToken)
                setShowSessionLimitModal(true)
                setRequireEmailVerification(false)
                setRequire2FA(false)
                return
            }
            showAlert('error', err.response?.data?.message || 'Invalid OTP')
        } finally {
            setLoading(false)
        }
    }

    async function handleStartRecovery() {
        if (!userId) return
        setLoading(true)
        try {
            const res = await api.post('/auth/start-2fa-recovery', { userId })
            setMaskedEmail(res.data.maskedEmail)
            setRecoveryStep('confirm')
            showAlert('success', res.data.message)
        } catch (err: any) {
            showAlert('error', err.response?.data?.message || 'Failed to start recovery')
        } finally {
            setLoading(false)
        }
    }

    async function handleSendRecoveryOTP() {
        if (!userId) return
        setLoading(true)
        try {
            await api.post('/auth/start-2fa-recovery', { userId })
            setRecoveryStep('otp')
            setCountdown(30)
            const timer = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(timer)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
            showAlert('success', 'Verification code sent')
        } catch (err: any) {
            showAlert('error', err.response?.data?.message || 'Failed to send code')
        } finally {
            setLoading(false)
        }
    }

    async function handleVerifyRecovery() {
        if (!recoveryOtp || recoveryOtp.length < 6) return
        setLoading(true)
        try {
            const res = await api.post('/auth/verify-2fa-recovery', { userId, otp: recoveryOtp })
            localStorage.setItem('token', res.data.token)
            await refreshUser()
            showAlert('success', res.data.message)
            router.push('/dashboard')
        } catch (err: any) {
            showAlert('error', err.response?.data?.message || 'Invalid recovery code')
        } finally {
            setLoading(false)
        }
    }


    async function onSubmit(values: z.infer<typeof loginSchema>) {
        setLoading(true)
        try {
            const res = await api.post('/auth/login', values)

            // 2FA Check
            if (res.data.require2FA) {
                setRequire2FA(true)
                setUserId(res.data.userId)
                showAlert('success', 'Enter 2FA Code')
                return
            }

            // Suspicious Login Check
            if (res.data.requireEmailVerification) {
                setRequireEmailVerification(true)
                setUserId(res.data.userId)
                showAlert('warning', res.data.message)
                return
            }

            localStorage.setItem('token', res.data.token)
            await refreshUser()
            showAlert('success', 'Login successful')
            router.push('/dashboard')
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Login failed'

            if (err.response?.data?.code === 'SESSION_LIMIT_EXCEEDED') {
                setActiveSessions(err.response.data.sessions)
                setSessionMgmtToken(err.response.data.sessionManagementToken)
                setShowSessionLimitModal(true)
                return
            }

            if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
                showAlert('error', 'Email verification required')
                localStorage.setItem('unverified_email', values.emailOrUsername)
                router.push(`/verify-email?email=${encodeURIComponent(values.emailOrUsername)}`)
                return
            }

            // Handle 429 Lockout or 401 Suspicious (if caught here)
            // 429 will come here
            if (err.response?.status === 429) {
                showAlert('danger', errorMessage) // Custom styling for danger/lockout?
                return
            }

            if (err.response?.status === 500 || err.code === 'ERR_NETWORK') {
                showAlert('danger', 'Server error, try again later')
            } else {
                showAlert('error', errorMessage)
            }
        } finally {
            setLoading(false)
        }
    }

    async function handleResendOTP() {
        if (!userId) return
        setLoading(true)
        try {
            if (requireEmailVerification) {
                await api.post('/auth/resend-suspicious-otp', { userId })
            } else {
                return
            }
            showAlert('success', 'OTP resent successfully')
        } catch (error: any) {
            showAlert('error', error.response?.data?.message || 'Failed to resend OTP')
        } finally {
            setLoading(false)
        }
    }

    if (require2FA || requireEmailVerification || recoveryStep !== 'none') {
        if (recoveryStep === 'confirm') {
            return (
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl">Verify Your Identity</CardTitle>
                        <CardDescription>
                            To reset your 2FA, verify your email address.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col items-center justify-center py-4 bg-muted/30 rounded-xl space-y-2">
                            <span className="text-sm text-muted-foreground uppercase tracking-widest">Registered Email</span>
                            <span className="text-lg font-mono font-bold">{maskedEmail}</span>
                        </div>
                        <Button onClick={handleSendRecoveryOTP} className="w-full h-12 text-base font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={loading}>
                            {loading ? "Sending..." : "Send Verification Code"}
                        </Button>
                        <div className="text-center">
                            <button onClick={() => setRecoveryStep('none')} className="text-sm text-muted-foreground hover:text-foreground underline transition-colors">
                                Back to 2FA
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )
        }

        if (recoveryStep === 'otp') {
            return (
                <Card>
                    <CardHeader className="text-center">
                        <CardTitle className="text-xl font-bold uppercase tracking-tight">Email Verification</CardTitle>
                        <CardDescription className="uppercase text-[10px] tracking-[0.2em]">
                            Enter the 6-digit code sent to your email
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="text-center py-2">
                            <Input
                                value={recoveryOtp}
                                onChange={(e) => setRecoveryOtp(e.target.value)}
                                placeholder="******"
                                className="text-center text-2xl h-16 tracking-[0.5em] font-mono border-2 focus-visible:ring-primary/20"
                                maxLength={6}
                            />
                        </div>

                        <div className="flex flex-col space-y-4">
                            <Button onClick={handleVerifyRecovery} className="w-full h-12 text-base font-bold uppercase tracking-wider transition-all hover:scale-[1.02] active:scale-[0.98]" disabled={loading || recoveryOtp.length < 6}>
                                {loading ? "Verifying..." : "Verify OTP"}
                            </Button>

                            <div className="text-center">
                                {countdown > 0 ? (
                                    <span className="text-xs text-muted-foreground uppercase tracking-widest">Resend code in {countdown}s</span>
                                ) : (
                                    <button
                                        onClick={handleSendRecoveryOTP}
                                        type="button"
                                        className="text-xs text-primary font-bold uppercase tracking-widest hover:underline transition-all"
                                        disabled={loading}
                                    >
                                        Resend Recovery Code
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="text-center pt-2">
                            <button onClick={() => setRecoveryStep('confirm')} className="text-sm text-muted-foreground hover:text-foreground underline transition-colors">
                                Back
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )
        }

        return (
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">
                        {requireEmailVerification ? "Unusual Activity Detected" : "Two-Factor Authentication"}
                    </CardTitle>
                    <CardDescription>
                        {requireEmailVerification
                            ? "We detected suspicious activity. Please enter the verification code sent to your email."
                            : "Enter the code from your authenticator app"}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-center py-2">
                        <Input
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="123456"
                            className="text-center text-xl tracking-widest"
                            maxLength={6}
                        />
                    </div>
                    <Button onClick={handleVerify} className="w-full" disabled={loading || otp.length < 6}>
                        {loading ? "Verifying..." : "Verify"}
                    </Button>

                    {!requireEmailVerification && (
                        <div className="flex flex-col items-center gap-2 pt-2">
                            <button
                                onClick={handleStartRecovery}
                                className="text-[12px] text-muted-foreground hover:text-primary transition-all hover:underline"
                            >
                                2FA unavailable?
                            </button>
                            <button
                                onClick={handleStartRecovery}
                                className="text-[12px] text-muted-foreground hover:text-primary transition-all hover:underline"
                            >
                                Reset 2FA
                            </button>
                        </div>
                    )}

                    {requireEmailVerification && (
                        <div className="text-center">
                            <button
                                onClick={handleResendOTP}
                                type="button"
                                className="text-sm text-primary hover:underline"
                                disabled={loading}
                            >
                                Resend Code
                            </button>
                        </div>
                    )}

                    <div className="text-center pt-4">
                        <button onClick={() => { setRequire2FA(false); setRequireEmailVerification(false); }} className="text-sm text-muted-foreground hover:text-foreground underline">
                            Back to Login
                        </button>
                    </div>
                </CardContent>
            </Card>
        )
    }


    return (
        <>
            <Card>
                <CardHeader className="text-center">
                    <CardTitle className="text-xl">Welcome back</CardTitle>
                    <CardDescription>
                        Login with your details or scan with the app
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {registered && (
                        <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm text-center">
                            Account created! Check your email for OTP.
                        </div>
                    )}
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="emailOrUsername"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email or Username</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Email or Username" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Password</FormLabel>
                                        <div className="relative">
                                            <FormControl>
                                                <Input type="password" placeholder="Password" {...field} />
                                            </FormControl>
                                        </div>
                                        <FormMessage />
                                        <div className="text-right">
                                            <a href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
                                                Forgot Password?
                                            </a>
                                        </div>
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full dark:bg-white dark:text-black dark:hover:bg-white/90" disabled={loading}>
                                {loading ? "Authenticating..." : "Login"}
                            </Button>

                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-card px-2 text-muted-foreground">Or</span>
                                </div>
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={handleAppLogin}
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Smartphone className="w-4 h-4 mr-2" />}
                                Login with App
                            </Button>
                            <div className="mt-4 text-center text-xs text-muted-foreground">
                                By continuing, you agree to our{" "}
                                <a href="/terms" className="underline hover:text-foreground transition-colors">
                                    Terms & Conditions
                                </a>
                            </div>
                            <div className="mt-2 text-center text-sm">
                                Don&apos;t have an account?{" "}
                                <a href="/signup" className="underline">
                                    Sign up
                                </a>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Dialog open={showSessionLimitModal} onOpenChange={setShowSessionLimitModal}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Session Limit Exceeded</DialogTitle>
                        <DialogDescription>
                            You have reached the maximum of 2 active sessions. Please remove one device to continue.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {activeSessions.map((session) => (
                            <div key={session.id} className="flex flex-col sm:flex-row items-center justify-between p-3 border rounded-lg gap-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        {session.device?.toLowerCase().includes('mobile') ? (
                                            <Smartphone className="w-4 h-4 text-primary" />
                                        ) : (
                                            <Laptop className="w-4 h-4 text-primary" />
                                        )}
                                    </div>
                                    <div className="text-sm">
                                        <div className="font-medium">{session.device}</div>
                                        <div className="text-xs text-muted-foreground">{session.ip} • {new Date(session.lastActive).toLocaleTimeString()}</div>
                                    </div>
                                </div>
                                <Button size="sm" variant="destructive" onClick={() => handleRemoveSession(session.id)}>
                                    Remove
                                </Button>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
                <DialogContent className="max-w-sm sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center">Login with App</DialogTitle>
                        <DialogDescription className="text-center">
                            Scan this QR code using the AtherChain mobile app to instantly log in.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col items-center justify-center space-y-6 py-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border">
                            {qrToken ? (
                                <QRCodeSVG value={qrToken} size={200} />
                            ) : (
                                <div className="w-[200px] h-[200px] flex items-center justify-center bg-gray-100 rounded-lg">
                                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                                </div>
                            )}
                        </div>
                        <div className="text-center space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">Waiting for scan...</p>
                            <p className="text-xs text-muted-foreground font-mono">
                                Expires in {Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, '0')}
                            </p>
                        </div>
                        <Button variant="outline" onClick={handleAppLogin} className="w-full">
                            Refresh QR Code
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
