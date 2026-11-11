"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { AlertCircle, CheckCircle2, ShieldCheck, KeyRound } from "lucide-react"
import api from "@/lib/api"
import { useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"

const schema = z.object({
    otp: z.string().length(6, "Verification code must be 6 digits"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
})

export function ResetPasswordForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const email = searchParams.get('email') || ""
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            otp: searchParams.get('token') || "",
            password: "",
            confirmPassword: "",
        },
    })

    async function onSubmit(values: z.infer<typeof schema>) {
        setLoading(true)
        setError(null)
        try {
            await api.post('/auth/reset-password', {
                email,
                token: values.otp,
                newPassword: values.password
            })
            setSuccess(true)
            setTimeout(() => {
                router.push('/login')
            }, 3000)
        } catch (err: any) {
            setError(err.response?.data?.message || 'Reset failed. Please check your code.')
        } finally {
            setLoading(false)
        }
    }

    if (success) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md mx-auto"
            >
                <Card className="border-border bg-card/50 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
                    <CardHeader className="relative text-center pb-8 pt-10">
                        <div className="mx-auto w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-6">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <CardTitle className="text-2xl font-bold tracking-tight">Access Restored</CardTitle>
                        <CardDescription className="text-muted-foreground mt-2 px-6 text-sm">
                            Your password has been reset successfully. Redirecting you to login...
                        </CardDescription>
                    </CardHeader>
                </Card>
            </motion.div>
        )
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md mx-auto"
        >
            <Card className="border-border bg-card/50 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />

                <CardHeader className="relative space-y-2 text-center pb-6 border-b border-border/50">
                    <div className="mx-auto w-12 h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center mb-2">
                        <KeyRound className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
                    <CardDescription className="text-muted-foreground text-sm px-4">
                        Enter the 6-digit code sent to your email and your new password.
                    </CardDescription>
                </CardHeader>

                <CardContent className="relative pt-8 space-y-6">
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-destructive/10 border border-destructive/20 p-4 rounded-xl flex items-center gap-3 text-destructive text-sm font-medium"
                            >
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="otp"
                                render={({ field }) => (
                                    <FormItem className="space-y-3">
                                        <div className="flex items-center justify-between px-1">
                                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Verification Code</FormLabel>
                                            <span className="text-[10px] font-mono text-primary/60">Sent to {email.split('@')[0].slice(0, 3)}***@{email.split('@')[1]}</span>
                                        </div>
                                        <FormControl>
                                            <div className="flex justify-center pt-2">
                                                <InputOTP maxLength={6} {...field}>
                                                    <InputOTPGroup className="gap-2 sm:gap-3">
                                                        {[0, 1, 2, 3, 4, 5].map((index) => (
                                                            <InputOTPSlot
                                                                key={index}
                                                                index={index}
                                                                className="w-10 h-12 sm:w-12 sm:h-14 text-lg border-border/50 bg-background/50 focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all rounded-lg"
                                                            />
                                                        ))}
                                                    </InputOTPGroup>
                                                </InputOTP>
                                            </div>
                                        </FormControl>
                                        <FormMessage className="text-center pt-1" />
                                    </FormItem>
                                )}
                            />

                            <div className="space-y-4 pt-2 border-t border-border/50">
                                <FormField
                                    control={form.control}
                                    name="password"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">New Password</FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                                    <Input
                                                        type="password"
                                                        placeholder="••••••••"
                                                        className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary/50 transition-all rounded-xl"
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="confirmPassword"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Confirm New Password</FormLabel>
                                            <FormControl>
                                                <div className="relative group">
                                                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                                                    <Input
                                                        type="password"
                                                        placeholder="••••••••"
                                                        className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary/50 transition-all rounded-xl"
                                                        {...field}
                                                    />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                        Updating Access...
                                    </div>
                                ) : (
                                    "Reset Password"
                                )}
                            </Button>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => router.push('/login')}
                                    className="text-xs font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest underline underline-offset-4"
                                >
                                    Back to Login
                                </button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </motion.div>
    )
}
