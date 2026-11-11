"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ShieldCheck } from "lucide-react"

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

const schema = z.object({
    email: z.string().email("Invalid email address"),
})

export function ForgotPasswordForm() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [sent, setSent] = useState(false)

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            email: "",
        },
    })

    async function onSubmit(values: z.infer<typeof schema>) {
        setLoading(true)
        try {
            await api.post('/auth/forgot-password', { email: values.email })
            setSent(true)
            toast.success('Reset link sent!')
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Request failed')
        } finally {
            setLoading(false)
        }
    }

    if (sent) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-sm mx-auto"
            >
                <Card className="border-border bg-card/50 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
                    <CardHeader className="relative text-center pb-8 pt-10">
                        <div className="mx-auto w-16 h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mb-6">
                            <ShieldCheck className="w-8 h-8 text-primary" />
                        </div>
                        <CardTitle className="text-xl font-bold tracking-tight">Code Sent</CardTitle>
                        <CardDescription className="text-muted-foreground mt-2 px-6 text-sm">
                            We've sent a 6-digit verification code to your email.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="relative space-y-4 pb-10 px-8">
                        <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl text-center text-primary/80 text-xs font-medium leading-relaxed uppercase tracking-wide">
                            Enter the code on the next screen to reset your password.
                        </div>
                        <Button
                            onClick={() => router.push(`/reset-password?email=${form.getValues('email')}`)}
                            className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg transition-all active:scale-[0.98]"
                        >
                            Continue to Reset
                        </Button>
                        <button
                            onClick={() => setSent(false)}
                            className="w-full text-xs font-medium text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest underline underline-offset-4"
                        >
                            Resend Code
                        </button>
                    </CardContent>
                </Card>
            </motion.div>
        )
    }

    return (
        <Card className="mx-auto max-w-sm w-full">
            <CardHeader className="text-center">
                <CardTitle className="text-xl">Forgot Password</CardTitle>
                <CardDescription>
                    Enter your email to receive recovery instructions
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email</FormLabel>
                                    <FormControl>
                                        <Input placeholder="user@example.com" type="email" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full dark:bg-white dark:text-black dark:hover:bg-white/90" disabled={loading}>
                            {loading ? "Sending..." : "Send Reset Link"}
                        </Button>
                        <div className="mt-4 text-center text-sm">
                            <Link href="/login" className="text-muted-foreground hover:text-foreground">
                                Back to Login
                            </Link>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}
