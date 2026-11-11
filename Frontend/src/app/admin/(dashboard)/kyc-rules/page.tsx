'use client';

import { AdminKYCRules } from '@/components/admin/AdminKYCRules';
import { ShieldAlert } from 'lucide-react';

export default function AdminKYCRulesPage() {
    return (
        <div className="space-y-8 w-full animate-in fade-in duration-700">
            <div className="max-w-5xl mx-auto w-full space-y-8">
                {/* Header Section */}
                <div className="flex flex-col gap-2 mb-8 px-2 md:px-0">
                    <h1 className="text-2xl font-black uppercase tracking-widest text-foreground">KYC Protocol Rules</h1>
                    <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Access Control Configuration</p>
                </div>

                <div className="w-full">
                    <AdminKYCRules />
                </div>
            </div>
        </div>
    );
}
