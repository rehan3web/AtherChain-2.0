'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Save, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface KYCRules {
    active: boolean;
    require_email_verified: boolean;
    require_2fa: boolean;
    min_account_age_days: number;
    min_referrals: number;
}

export function AdminKYCRules() {
    const [rules, setRules] = useState<KYCRules | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchRules = async () => {
            try {
                const res = await api.get('/admin/kyc/rules');
                setRules(res.data);
            } catch (error) {
                console.error('Failed to fetch rules', error);
                toast.error("Failed to load KYC rules. Using defaults.");
                setRules({
                    active: true,
                    require_email_verified: true,
                    require_2fa: true,
                    min_account_age_days: 7,
                    min_referrals: 10
                });
            } finally {
                setLoading(false);
            }
        };
        fetchRules();
    }, []);

    const handleSave = async () => {
        if (!rules) return;
        setSaving(true);
        try {
            await api.put('/admin/kyc/rules', rules);
            toast.success("KYC Rules updated successfully");
        } catch (error) {
            console.error('Failed to update rules', error);
            toast.error("Failed to update KYC rules");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="h-full flex items-center justify-center min-h-[200px]"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    }

    if (!rules) return <div className="p-4 text-red-500">Error loading rules.</div>;

    return (
        <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group h-full">
            <div className="absolute -top-10 -right-10 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity rotate-12 -z-0">
                <ShieldAlert size={240} className="text-primary" />
            </div>

            <div className="relative z-10 space-y-8">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 pb-6 border-b border-border">
                    <div className="flex items-center gap-4">
                        <div className="p-2 border border-border bg-secondary">
                            <ShieldAlert className="h-5 w-5 text-foreground" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold uppercase tracking-widest">Access Control</h2>
                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">
                                Eligibility Criteria
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Master Switch */}
                    <div className="flex items-center justify-between p-6 bg-secondary/50 border border-border group/switch transition-colors hover:bg-secondary">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                                Enforce Protocol <span className="text-foreground font-mono">[Main Rule]</span>
                            </Label>
                            <p className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest leading-relaxed mt-1">
                                Bypass all eligibility filters when disabled.
                            </p>
                        </div>
                        <Switch
                            checked={rules.active}
                            onCheckedChange={(c) => setRules({ ...rules, active: c })}
                            className="data-[state=checked]:bg-foreground data-[state=unchecked]:bg-secondary border-border"
                        />
                    </div>

                    {/* Sub Rules */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="flex items-center justify-between p-5 bg-secondary/30 border border-border">
                            <Label htmlFor="email-check" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Email Verification</Label>
                            <Switch
                                id="email-check"
                                checked={rules.require_email_verified}
                                onCheckedChange={(c) => setRules({ ...rules, require_email_verified: c })}
                            />
                        </div>

                        <div className="flex items-center justify-between p-5 bg-secondary/30 border border-border">
                            <Label htmlFor="2fa-check" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Require 2FA</Label>
                            <Switch
                                id="2fa-check"
                                checked={rules.require_2fa}
                                onCheckedChange={(c) => setRules({ ...rules, require_2fa: c })}
                            />
                        </div>
                    </div>

                    {/* Thresholds */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 md:gap-8">
                        <div className="space-y-3 p-6 bg-secondary/30 border border-border">
                            <Label htmlFor="age" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Min Account Age [Days]</Label>
                            <Input
                                id="age"
                                type="number"
                                value={rules.min_account_age_days}
                                onChange={(e) => setRules({ ...rules, min_account_age_days: parseInt(e.target.value) || 0 })}
                                className="h-12 bg-background border-border rounded-none font-mono text-base focus:ring-0 focus:border-foreground transition-colors"
                            />
                        </div>
                        <div className="space-y-3 p-6 bg-secondary/30 border border-border">
                            <Label htmlFor="ref" className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Minimum Referrals</Label>
                            <Input
                                id="ref"
                                type="number"
                                value={rules.min_referrals}
                                onChange={(e) => setRules({ ...rules, min_referrals: parseInt(e.target.value) || 0 })}
                                className="h-12 bg-background border-border rounded-none font-mono text-base focus:ring-0 focus:border-foreground transition-colors"
                            />
                        </div>
                    </div>



                    <Button
                        className="w-full h-14 rounded-none font-bold uppercase tracking-[0.2em] border border-border hover:bg-foreground hover:text-background transition-colors"
                        onClick={handleSave}
                        disabled={saving}
                        variant="outline"
                    >
                        {saving ? (
                            <div className="flex items-center gap-3">
                                <Loader2 className="animate-spin w-5 h-5" />
                                <span>Syncing...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <Save className="w-5 h-5" />
                                <span>Save Operations</span>
                            </div>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
