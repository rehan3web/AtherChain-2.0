'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import AuthLayout from '@/components/auth/AuthLayout';
import { toast } from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        phone: '',
        referralCode: '',
        password: '',
        confirmPassword: '',
    });
    const [loading, setLoading] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match');
            setLoading(false);
            return;
        }

        try {
            await api.post('/auth/register', formData);
            localStorage.setItem('unverified_email', formData.email);
            toast.success('Registration Successful!');
            // Redirect to Verify Email page with email param
            router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="Initialize Node" description="Join the Ather Neural Grid">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <Input name="firstName" placeholder="First Name" onChange={handleChange} required />
                    <Input name="lastName" placeholder="Last Name" onChange={handleChange} required />
                </div>

                <Input name="username" placeholder="Username" onChange={handleChange} required />
                <Input name="email" type="email" placeholder="Email Address" onChange={handleChange} required />
                <div className="grid grid-cols-2 gap-4">
                    <Input name="phone" placeholder="Phone Number" onChange={handleChange} />
                    <Input name="referralCode" placeholder="Referral Code (Optional)" onChange={handleChange} />
                </div>

                <Input name="password" type="password" placeholder="Password" onChange={handleChange} required />
                <Input name="confirmPassword" type="password" placeholder="Confirm Password" onChange={handleChange} required />

                <div className="pt-4">
                    <Button type="submit" variant="default" className="w-full text-base font-bold shadow-[0_0_30px_rgba(110,84,255,0.3)] hover:shadow-[0_0_40px_rgba(110,84,255,0.5)] dark:bg-white dark:text-black dark:hover:bg-white/90" disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        DEPLOY IDENTITY
                    </Button>
                </div>
            </form>

            <div className="mt-6 text-center text-sm text-white/40 font-mono tracking-widest">
                ALREADY INITIALIZED?{' '}
                <Link href="/login" className="text-secondary-cyan hover:text-white transition-colors uppercase">
                    ACCESS TERMINAL
                </Link>
            </div>
        </AuthLayout>
    );
}
