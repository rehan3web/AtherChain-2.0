'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Loader2, Upload, Trash2, Save, FileCheck } from 'lucide-react';
import { CountrySelect } from "@/components/ui/CountrySelect";
import { cn } from '@/lib/utils';
import Image from 'next/image';

export function ProfileSection() {
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fullName, setFullName] = useState('');
    const [country, setCountry] = useState('');

    useEffect(() => {
        if (user) {
            setFullName(user.full_name || '');
            setCountry(user.country || '');
        }
    }, [user]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.put('/user/profile', { fullName, country });
            toast.success('Profile updated successfully');
            refreshUser();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        setUploading(true);
        try {
            await api.post('/user/profile/image', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('Profile picture updated');
            refreshUser();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveImage = async () => {
        if (!confirm('Are you sure you want to remove your profile picture?')) return;
        setUploading(true);
        try {
            await api.delete('/user/profile/image');
            toast.success('Profile picture removed');
            refreshUser();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to remove image');
        } finally {
            setUploading(false);
        }
    };

    const getFullImageUrl = (path?: string) => {
        if (!path) return "";
        if (path.startsWith('http')) return path;
        return `${api.defaults.baseURL}${path}`;
    };

    const getKycConfig = (status?: string) => {
        switch (status) {
            case 'approved':
                return { text: 'Verified', color: 'text-green-500', bg: 'bg-green-500/10', borderColor: 'border-green-500/20' };
            case 'rejected':
                return { text: 'Rejected', color: 'text-red-500', bg: 'bg-red-500/10', borderColor: 'border-red-500/20' };
            case 'pending':
                return { text: 'Pending', color: 'text-yellow-500', bg: 'bg-yellow-500/10', borderColor: 'border-yellow-500/20' };
            default:
                return { text: 'Unverified', color: 'text-zinc-500', bg: 'bg-zinc-500/10', borderColor: 'border-zinc-500/20' };
        }
    };

    if (!user) return null;

    const kyc = getKycConfig(user.kyc_status);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Profile Picture */}
            <div className="flex flex-col md:flex-row items-center gap-6 p-6 border border-border rounded-lg bg-card/50">
                <div className="relative">
                    <Avatar className="w-24 h-24 border-2 border-primary/20">
                        <AvatarImage src={getFullImageUrl(user.profile_image)} className="object-cover" />
                        <AvatarFallback className="text-2xl bg-secondary">{user.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {user.kyc_status === 'approved' && (
                        <div className="absolute bottom-0 right-0 w-8 h-8 bg-background rounded-full flex items-center justify-center border-2 border-border p-1.5 shadow-lg">
                            <Image src="/tick.png" alt="Verified" width={24} height={24} className="object-contain" />
                        </div>
                    )}
                </div>

                <div className="space-y-2 text-center md:text-left flex-1">
                    <h3 className="font-medium text-lg">Profile Picture</h3>
                    <p className="text-sm text-muted-foreground">Upload a new profile picture. Max size 5MB.</p>
                </div>

                <div className="flex flex-col gap-2 w-full md:w-auto">
                    <div className="relative">
                        <input
                            type="file"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            accept="image/*"
                            onChange={handleImageUpload}
                            disabled={uploading}
                        />
                        <Button variant="outline" className="w-full" disabled={uploading}>
                            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                            Change Picture
                        </Button>
                    </div>
                    {user.profile_image && (
                        <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleRemoveImage} disabled={uploading}>
                            <Trash2 className="w-4 h-4 mr-2" /> Remove
                        </Button>
                    )}
                </div>
            </div>

            {/* Profile Info Form */}
            <form onSubmit={handleUpdateProfile} className="space-y-6 p-6 border border-border rounded-lg bg-card/50">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <h3 className="font-medium text-lg">Personal Information</h3>
                        <div className={cn(
                            "flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider",
                            kyc.bg,
                            kyc.color,
                            kyc.borderColor
                        )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full", kyc.color.replace('text-', 'bg-'))} />
                            {kyc.text}
                        </div>
                    </div>
                    <p className="text-sm text-muted-foreground">Update your personal details.</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input id="username" value={user.username} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" value={user.email} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name</Label>
                        <Input
                            id="fullName"
                            placeholder="John Doe"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="country">Country</Label>
                        <CountrySelect
                            value={country}
                            onChange={(c) => setCountry(c.name)}
                        />
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Save Changes
                    </Button>
                </div>
            </form>
        </div>
    );
}
