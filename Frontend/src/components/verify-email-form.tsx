"use client"

import { useState, useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
import api from "@/lib/api"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const schema = z.object({
    otp: z.string().min(6, {
        message: "Your one-time password must be 6 characters.",
    }),
})

export function VerifyEmailForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);

    useEffect(() => {
        const storedEmail = localStorage.getItem('unverified_email');
        const paramEmail = searchParams.get('email');
        if (paramEmail) setEmail(paramEmail);
        else if (storedEmail) setEmail(storedEmail);
    }, [searchParams]);

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            otp: "",
        },
    })

    async function onSubmit(values: z.infer<typeof schema>) {
        setLoading(true);
        try {
            await api.post('/auth/verify-email', { email, otp: values.otp });
            toast.success('Email Verified Successfully!');
            localStorage.removeItem('unverified_email');
            router.push('/login');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    }

    const handleResend = async () => {
        setResendLoading(true);
        try {
            await api.post('/auth/resend-otp', { email });
            toast.success('OTP Resent! Check your email.');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to resend OTP');
        } finally {
            setResendLoading(false);
        }
    };

    return (
        <Card className="mx-auto max-w-sm w-full">
            <CardHeader className="text-center">
                <CardTitle className="text-xl">Verify Email</CardTitle>
                <CardDescription>
                    Enter the code sent to {email}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="otp"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>One-Time Password</FormLabel>
                                    <FormControl>
                                        <div className="flex justify-center">
                                            <InputOTP maxLength={6} {...field}>
                                                <InputOTPGroup>
                                                    <InputOTPSlot index={0} />
                                                    <InputOTPSlot index={1} />
                                                    <InputOTPSlot index={2} />
                                                    <InputOTPSlot index={3} />
                                                    <InputOTPSlot index={4} />
                                                    <InputOTPSlot index={5} />
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </div>
                                    </FormControl>
                                    <FormDescription className="text-center">
                                        Please enter the one-time password sent to your email.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? "Verifying..." : "Verify Identity"}
                        </Button>
                    </form>
                </Form>
                <div className="mt-4 text-center">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleResend}
                        disabled={resendLoading}
                        className="text-xs"
                    >
                        {resendLoading ? 'Sending...' : 'Resend Verification Code'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
