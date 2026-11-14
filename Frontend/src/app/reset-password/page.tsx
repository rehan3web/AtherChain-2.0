'use client';

import { Suspense } from 'react';
import AuthLayout from '@/components/auth/AuthLayout';
import { ResetPasswordForm } from '@/components/reset-password-form';
import { Loader } from "@/components/ui/Loader"

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<Loader fullScreen />}>
            <AuthLayout title="Reset Password" description="Secure your account">
                <ResetPasswordForm />
            </AuthLayout>
        </Suspense>
    );
}
