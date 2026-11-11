import { Suspense } from 'react';
import AuthLayout from '@/components/auth/AuthLayout';
import { LoginForm } from '@/components/login-form';
import { Loader } from "@/components/ui/Loader"

export default function LoginPage() {
    return (
        <Suspense fallback={<Loader fullScreen />}>
            <AuthLayout title="Login" description="Login to your account">
                <LoginForm />
            </AuthLayout>
        </Suspense>
    );
}
