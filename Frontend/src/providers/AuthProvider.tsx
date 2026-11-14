'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '@/lib/api';

interface User {
    id: string;
    username: string;
    email: string;
    role: string;
    balance_at?: string;
    balance_ath?: string;
    balance_wath?: string;
    at_balance?: string;
    is_swap_enabled?: boolean;
    address?: string;
    kyc_status?: 'pending' | 'approved' | 'rejected' | 'unverified';
    referral_code?: string;
    full_name?: string;
    country?: string;
    profile_image?: string;
    twofa_enabled?: boolean;
    passkey_enabled?: boolean;
    passkey_credentials?: any[];
    next_swap_at?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    logout: () => void;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    logout: () => { },
    refreshUser: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const fetchUser = async () => {
        if (pathname?.startsWith('/admin')) {
            setLoading(false);
            return;
        }
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }
            const res = await api.get('/user/me');
            setUser(res.data);
        } catch (error: any) {
            console.error('Failed to fetch user', error);
            if (error.response?.status === 403 && error.response?.data?.code === 'USER_BLOCKED') {
                if (pathname !== '/help' && !pathname?.startsWith('/delete-request')) {
                    router.push('/blocked');
                }
            } else {
                // If error is 401, interceptor handles redirect if NOT on admin page.
                // We just clear the user state here.
                setUser(null);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUser();
    }, []);

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, loading, logout, refreshUser: fetchUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
