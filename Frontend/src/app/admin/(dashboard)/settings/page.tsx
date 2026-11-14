'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAlert } from '@/providers/AlertProvider';
import { Zap, RefreshCw, Users as UsersIcon, ArrowRightLeft, Hammer } from 'lucide-react';

export default function SettingsPage() {
    const [settings, setSettings] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const { showAlert } = useAlert();

    const fetchSettings = async () => {
        const token = localStorage.getItem('admin_token');
        try {
            const res = await api.get('/admin/settings', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setSettings(res.data);
        } catch (error) {
            console.error(error);
            showAlert('danger', 'Error fetching settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const updateSetting = async (key: string, newValue: any) => {
        const token = localStorage.getItem('admin_token');
        try {
            await api.post('/admin/settings', { key, value: newValue }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showAlert('success', 'Setting updated');
            fetchSettings();
        } catch (error) {
            showAlert('danger', 'Update failed');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[50vh]">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const mining = settings.mining || { active: true, daily_reward: 100 };
    const swap = settings.swap || { active: true, rate: 1, fee_percent: 1 };
    const transfer = settings.transfer || { active: true };
    const referral = settings.referral || { active: true, reward_unverified: 10, reward_verified: 50 };

    return (
        <div className="space-y-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {/* Header Section */}
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-black uppercase tracking-widest text-foreground">Protocol Settings</h1>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Global Configuration & Liquidity</p>
            </div>

            {/* Mining Settings */}
            <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                    <Zap className="w-16 md:w-24 h-16 md:h-24 text-foreground" />
                </div>

                <div className="relative z-10 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-2 border border-border bg-secondary">
                                <Zap className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-widest">Mining</h2>
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">System Rewards</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:block">Status</span>
                            <StatusToggle
                                active={mining.active}
                                onToggle={(val) => updateSetting('mining', { ...mining, active: val })}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4 p-6 bg-secondary/30 border border-border">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                Daily Distribution <span className="text-foreground font-mono">[Reward]</span>
                            </label>
                            <div className="flex gap-3">
                                <Input
                                    type="number"
                                    defaultValue={mining.daily_reward}
                                    onChange={(e) => mining.daily_reward = parseInt(e.target.value)}
                                    className="bg-background border-border h-12 font-mono text-lg text-foreground focus:ring-0 focus:border-foreground transition-colors rounded-none"
                                />
                                <Button
                                    variant="outline"
                                    className="h-12 px-8 font-bold uppercase tracking-widest border-border hover:bg-foreground hover:text-background transition-colors rounded-none"
                                    onClick={() => updateSetting('mining', mining)}
                                >
                                    Update
                                </Button>
                            </div>
                        </div>

                        {/* Mining Cycle Selection */}
                        <div className="space-y-4 p-6 bg-secondary/30 border border-border">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                Mining Cycle <span className="text-foreground font-mono">[Duration]</span>
                            </label>
                            <div className="flex bg-background border border-border p-1">
                                <button
                                    onClick={() => updateSetting('mining_cycle_hours', "12")}
                                    className={`flex-1 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-none border ${settings.mining_cycle_hours === "12"
                                        ? 'bg-foreground text-background border-foreground'
                                        : 'text-muted-foreground border-transparent hover:text-foreground'
                                        }`}
                                >
                                    12 Hours
                                </button>
                                <button
                                    onClick={() => updateSetting('mining_cycle_hours', "24")}
                                    className={`flex-1 px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-none border ${settings.mining_cycle_hours !== "12"
                                        ? 'bg-foreground text-background border-foreground'
                                        : 'text-muted-foreground border-transparent hover:text-foreground'
                                        }`}
                                >
                                    24 Hours
                                </button>
                            </div>
                            <p className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                                {settings.mining_cycle_hours === "12" ? "Target: 15 Referral Sessions" : "Target: 7 Referral Sessions"}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Swap Settings */}
            <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500 -rotate-12">
                    <RefreshCw className="w-16 md:w-24 h-16 md:h-24 text-foreground" />
                </div>

                <div className="relative z-10 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-2 border border-border bg-secondary">
                                <RefreshCw className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-widest">Swap</h2>
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">Liquidity Layer</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:block">Status</span>
                            <StatusToggle
                                active={swap.active}
                                onToggle={(val) => updateSetting('swap', { ...swap, active: val })}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 p-6 bg-secondary/30 border border-border">
                        <div className="flex items-center gap-4">
                            <div className="p-2 border border-border bg-background">
                                <ArrowRightLeft className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-widest">Global Cooldown</h3>
                                <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">24-Hour Swap Limit Enforcement</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <StatusToggle
                                active={swap.cooldown_enabled !== false}
                                onToggle={(val) => updateSetting('swap', { ...swap, cooldown_enabled: val })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4 p-6 bg-secondary/30 border border-border">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                Rate <span className="text-foreground font-mono">[1 AT : X ATH]</span>
                            </label>
                            <div className="flex gap-3">
                                <Input
                                    type="number"
                                    step="0.0001"
                                    defaultValue={swap.rate}
                                    onChange={(e) => swap.rate = parseFloat(e.target.value)}
                                    className="bg-background border-border h-12 font-mono text-lg text-foreground focus:ring-0 focus:border-foreground transition-colors rounded-none"
                                />
                                <Button
                                    variant="outline"
                                    className="h-12 px-8 font-bold uppercase tracking-widest border-border hover:bg-foreground hover:text-background transition-colors rounded-none"
                                    onClick={() => updateSetting('swap', swap)}
                                >
                                    Set
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-4 p-6 bg-secondary/30 border border-border">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                Fee <span className="text-foreground font-mono">[%]</span>
                            </label>
                            <div className="flex gap-3">
                                <Input
                                    type="number"
                                    step="0.1"
                                    defaultValue={swap.fee_percent}
                                    onChange={(e) => swap.fee_percent = parseFloat(e.target.value)}
                                    className="bg-background border-border h-12 font-mono text-lg text-foreground focus:ring-0 focus:border-foreground transition-colors rounded-none"
                                />
                                <Button
                                    variant="outline"
                                    className="h-12 px-8 font-bold uppercase tracking-widest border-border hover:bg-foreground hover:text-background transition-colors rounded-none"
                                    onClick={() => updateSetting('swap', swap)}
                                >
                                    Set
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transfer Settings */}
            <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500 rotate-12">
                    <ArrowRightLeft className="w-16 md:w-24 h-16 md:h-24 text-foreground" />
                </div>

                <div className="relative z-10 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-2 border border-border bg-secondary">
                                <ArrowRightLeft className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-widest">Transfer</h2>
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">P2P Network</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:block">Status</span>
                            <StatusToggle
                                active={transfer.active}
                                onToggle={(val) => updateSetting('transfer', { ...transfer, active: val })}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Daily Boost Settings */}
            <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                    <Zap className="w-16 md:w-24 h-16 md:h-24 text-foreground" />
                </div>

                <div className="relative z-10 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-2 border border-border bg-secondary">
                                <Zap className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-widest">Daily Boost</h2>
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">Mining Acceleration</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:block">Status</span>
                            <StatusToggle
                                active={settings.boost_enabled !== 'false'}
                                onToggle={async (val) => {
                                    const token = localStorage.getItem('admin_token');
                                    try {
                                        await api.put('/admin/boost-settings', {
                                            rewardAmount: settings.boost_reward_amount,
                                            maxBoosts: settings.daily_boost_max,
                                            enabled: val
                                        }, {
                                            headers: { Authorization: `Bearer ${token}` }
                                        });
                                        showAlert('success', 'Boost status updated');
                                        fetchSettings();
                                    } catch (error) {
                                        showAlert('danger', 'Update failed');
                                    }
                                }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4 p-6 bg-secondary/30 border border-border">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                Boost Reward <span className="text-foreground font-mono">[+AT Per Click]</span>
                            </label>
                            <div className="flex gap-3">
                                <Input
                                    type="number"
                                    step="0.01"
                                    defaultValue={settings.boost_reward_amount || 0.1}
                                    id="boost_reward_amount_input"
                                    className="bg-background border-border h-12 font-mono text-lg text-foreground focus:ring-0 focus:border-foreground transition-colors rounded-none"
                                />
                                <Button
                                    variant="outline"
                                    className="h-12 px-8 font-bold uppercase tracking-widest border-border hover:bg-foreground hover:text-background transition-colors rounded-none"
                                    onClick={async () => {
                                        const input = document.getElementById('boost_reward_amount_input') as HTMLInputElement;
                                        const newValue = input.value;
                                        const token = localStorage.getItem('admin_token');
                                        try {
                                            await api.put('/admin/boost-settings', {
                                                rewardAmount: newValue,
                                                maxBoosts: settings.daily_boost_max,
                                                enabled: settings.boost_enabled !== 'false'
                                            }, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            });
                                            showAlert('success', 'Boost reward updated');
                                            fetchSettings();
                                        } catch (error) {
                                            showAlert('danger', 'Update failed');
                                        }
                                    }}
                                >
                                    Update
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-4 p-6 bg-secondary/30 border border-border">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                Max Boosts <span className="text-foreground font-mono">[Per Cycle]</span>
                            </label>
                            <div className="flex gap-3">
                                <Input
                                    type="number"
                                    defaultValue={settings.daily_boost_max || 3}
                                    id="daily_boost_max_input"
                                    className="bg-background border-border h-12 font-mono text-lg text-foreground focus:ring-0 focus:border-foreground transition-colors rounded-none"
                                />
                                <Button
                                    variant="outline"
                                    className="h-12 px-8 font-bold uppercase tracking-widest border-border hover:bg-foreground hover:text-background transition-colors rounded-none"
                                    onClick={async () => {
                                        const input = document.getElementById('daily_boost_max_input') as HTMLInputElement;
                                        const newValue = input.value;
                                        const token = localStorage.getItem('admin_token');
                                        try {
                                            await api.put('/admin/boost-settings', {
                                                rewardAmount: settings.boost_reward_amount,
                                                maxBoosts: newValue,
                                                enabled: settings.boost_enabled !== 'false'
                                            }, {
                                                headers: { Authorization: `Bearer ${token}` }
                                            });
                                            showAlert('success', 'Max boosts updated');
                                            fetchSettings();
                                        } catch (error) {
                                            showAlert('danger', 'Update failed');
                                        }
                                    }}
                                >
                                    Update
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Maintenance Settings */}
            <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                    <Hammer className="w-16 md:w-24 h-16 md:h-24 text-foreground" />
                </div>

                <div className="relative z-10 space-y-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="p-2 border border-border bg-secondary">
                                <Hammer className="w-5 h-5 text-foreground" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold uppercase tracking-widest">Maintenance Protocol</h2>
                                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">System Wide Lockdown</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 w-full sm:w-auto">
                            <StatusToggle
                                active={settings.maintenance_mode === 'true'}
                                onToggle={(val) => updateSetting('maintenance_mode', val ? 'true' : 'false')}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4 p-6 bg-secondary/30 border border-border">
                            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                Estimated Completion <span className="text-foreground font-mono">[Countdown Target]</span>
                            </label>
                            <div className="flex gap-3">
                                <Input
                                    type="datetime-local"
                                    defaultValue={settings.maintenance_until ? new Date(settings.maintenance_until).toISOString().slice(0, 16) : ''}
                                    id="maintenance_until_input"
                                    className="bg-background border-border h-12 font-mono text-sm text-foreground focus:ring-0 focus:border-foreground transition-colors rounded-none inv-color-scheme [&::-webkit-calendar-picker-indicator]:filter-none"
                                />
                                <Button
                                    variant="outline"
                                    className="h-12 px-8 font-bold uppercase tracking-widest border-border hover:bg-foreground hover:text-background transition-colors rounded-none"
                                    onClick={() => {
                                        const val = (document.getElementById('maintenance_until_input') as HTMLInputElement).value;
                                        updateSetting('maintenance_until', new Date(val).toISOString());
                                    }}
                                >
                                    Schedule
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Referral Settings */}
            <ReferralSettingsSection showAlert={showAlert} />
        </div >
    );
}

function StatusToggle({ active, onToggle }: { active: boolean, onToggle: (val: boolean) => void }) {
    return (
        <div className="flex bg-secondary/30 border border-border p-1 w-full sm:w-auto">
            <button
                onClick={() => !active && onToggle(true)}
                className={`flex-1 sm:flex-none px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 rounded-none border ${active
                    ? 'bg-foreground text-background border-foreground shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                    }`}
            >
                Enabled
            </button>
            <button
                onClick={() => active && onToggle(false)}
                className={`flex-1 sm:flex-none px-6 py-2 text-[10px] font-bold uppercase tracking-widest transition-all duration-300 rounded-none border ${!active
                    ? 'bg-red-600 text-white border-red-600 shadow-[0_0_15px_rgba(220,38,38,0.3)]'
                    : 'text-muted-foreground border-transparent hover:text-red-400'
                    }`}
            >
                Disabled
            </button>
        </div>
    );
}

function ReferralSettingsSection({ showAlert }: { showAlert: any }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [data, setData] = useState({
        registration_reward_at: 0,
        kyc_verified_reward_at: 0
    });

    const fetchData = async () => {
        const token = localStorage.getItem('admin_token');
        try {
            const res = await api.get('/admin/referral-settings', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setData({
                registration_reward_at: parseFloat(res.data.registration_reward_at),
                kyc_verified_reward_at: parseFloat(res.data.kyc_verified_reward_at)
            });
        } catch (error) {
            showAlert('danger', 'Failed to load referral settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleUpdate = async () => {
        if (data.registration_reward_at < 0 || data.kyc_verified_reward_at < 0) {
            showAlert('danger', 'Rewards cannot be negative');
            return;
        }

        setSaving(true);
        const token = localStorage.getItem('admin_token');
        try {
            await api.put('/admin/referral-settings', {
                registrationReward: data.registration_reward_at,
                kycReward: data.kyc_verified_reward_at
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showAlert('success', 'Referral settings updated successfully');
            fetchData();
        } catch (error) {
            showAlert('danger', 'Update failed');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="bg-card border border-border p-6 md:p-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 md:p-8 opacity-10 transition-transform group-hover:scale-110 duration-500">
                <UsersIcon className="w-16 md:w-24 h-16 md:h-24 text-foreground" />
            </div>

            <div className="relative z-10 space-y-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="p-2 border border-border bg-secondary">
                            <UsersIcon className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold uppercase tracking-widest">Referral Rewards</h2>
                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-[0.2em] mt-1">Network Growth</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4 p-6 bg-secondary/30 border border-border">
                        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            Unverified Referral Reward <span className="text-foreground font-mono">[AT Value]</span>
                        </label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={data.registration_reward_at}
                            onChange={(e) => setData({ ...data, registration_reward_at: parseFloat(e.target.value) || 0 })}
                            className="bg-background border-border h-12 font-mono text-lg text-foreground focus:ring-0 focus:border-foreground transition-colors rounded-none"
                        />
                    </div>

                    <div className="space-y-4 p-6 bg-secondary/30 border border-border">
                        <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                            Verified Referral Reward <span className="text-foreground font-mono">[AT Value]</span>
                        </label>
                        <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={data.kyc_verified_reward_at}
                            onChange={(e) => setData({ ...data, kyc_verified_reward_at: parseFloat(e.target.value) || 0 })}
                            className="bg-background border-border h-12 font-mono text-lg text-foreground focus:ring-0 focus:border-foreground transition-colors rounded-none"
                        />
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button
                        variant="outline"
                        disabled={saving}
                        className="h-12 px-12 font-bold uppercase tracking-widest border-border hover:bg-foreground hover:text-background transition-colors rounded-none w-full sm:w-auto"
                        onClick={handleUpdate}
                    >
                        {saving ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                Updating...
                            </div>
                        ) : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
