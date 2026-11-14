'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import api from '@/lib/api';

export default function AdminLogin() {
const router = useRouter();

const [email, setEmail] = useState('');
const [password, setPassword] = useState('');
const [error, setError] = useState('');
const [loading, setLoading] = useState(false);

const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
        const res = await api.post('/admin/login', { email, password });
        localStorage.setItem('admin_token', res.data.token);
        router.push('/admin/dashboard');
    } catch (err: any) {
        setError('Invalid credentials');
    } finally {
        setLoading(false);
    }
};

return (
    <div className="flex items-center justify-center min-h-screen bg-background text-foreground relative overflow-hidden p-6">

        {/* background grid */}
        <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
            <div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[320px] w-[320px] rounded-full bg-primary/20 opacity-20 blur-[120px]" />
        </div>

        <Card className="w-full max-w-md border-border bg-card/80 backdrop-blur-sm shadow-xl relative overflow-hidden z-10">

            {/* top glow line */}
            <div className="absolute top-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent left-0 opacity-60" />

            <CardHeader className="text-center pb-4 space-y-2">

                <CardTitle className="text-3xl font-black uppercase tracking-tight">
                    Admin <span className="text-muted-foreground">Panel</span>
                </CardTitle>

                <CardDescription className="text-[10px] uppercase tracking-[0.25em] opacity-60">
                    Secure Authentication Portal
                </CardDescription>

            </CardHeader>

            <CardContent>

                <form onSubmit={handleLogin} className="space-y-5">

                    {/* email */}
                    <div className="space-y-2">
                        <Input
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-12 bg-background border-border focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    {/* password */}
                    <div className="space-y-2">
                        <Input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-12 bg-background border-border focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>

                    {/* error */}
                    {error && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-semibold">
                            {error}
                        </div>
                    )}

                    {/* button */}
                    <Button
                        type="submit"
                        className="w-full h-12 font-bold uppercase tracking-wider text-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Authenticating...
                            </>
                        ) : (
                            "Admin Login"
                        )}
                    </Button>

                </form>

            </CardContent>

        </Card>
    </div>
);


}
