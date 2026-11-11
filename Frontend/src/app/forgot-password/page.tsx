'use client';

import { Suspense } from 'react';
import AuthLayout from '@/components/auth/AuthLayout';
import { ForgotPasswordForm } from '@/components/forgot-password-form';
import { Loader } from "@/components/ui/Loader"

export default function ForgotPasswordPage() {
    return (
        <Suspense fallback={<Loader fullScreen />}>
            <AuthLayout title="Forgot Password" description="Recovery instructions">
                <ForgotPasswordForm />
            </AuthLayout>
        </Suspense>
    );
}
