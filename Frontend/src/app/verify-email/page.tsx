'use client';

import { Suspense } from 'react';
import AuthLayout from '@/components/auth/AuthLayout';
import { VerifyEmailForm } from '@/components/verify-email-form';
import { Loader } from "@/components/ui/Loader"

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={<Loader fullScreen />}>
            <AuthLayout title="Verify Email" description="Enter verification code">
                <VerifyEmailForm />
            </AuthLayout>
        </Suspense>
    );
}
