'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ProfileSection } from './components/ProfileSection';
import { SecuritySection } from './components/SecuritySection';
import { PasswordSection } from './components/PasswordSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Shield, Lock } from 'lucide-react';

export default function AccountPage() {
    return (
        <div className="min-h-screen bg-background text-foreground p-4 md:p-8 lg:p-12 font-sans">
            <div className="max-w-4xl mx-auto space-y-8">

                {/* Header */}
                <header className="space-y-4 border-b border-border pb-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2"
                    >
                        <div className="w-2 h-2 bg-primary rounded-sm" />
                        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                            Account Settings
                        </h1>
                    </motion.div>
                    <p className="text-muted-foreground">
                        Manage your profile, security preferences, and login credentials.
                    </p>
                </header>

                {/* Tabs */}
                <Tabs defaultValue="profile" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
                        <TabsTrigger value="profile" className="flex items-center gap-2">
                            <User className="w-4 h-4" /> Profile
                        </TabsTrigger>
                        <TabsTrigger value="security" className="flex items-center gap-2">
                            <Shield className="w-4 h-4" /> Security
                        </TabsTrigger>
                        <TabsTrigger value="password" className="flex items-center gap-2">
                            <Lock className="w-4 h-4" /> Password
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="profile" className="space-y-6">
                        <ProfileSection />
                    </TabsContent>

                    <TabsContent value="security" className="space-y-6">
                        <SecuritySection />
                    </TabsContent>

                    <TabsContent value="password" className="space-y-6">
                        <PasswordSection />
                    </TabsContent>
                </Tabs>

            </div>
        </div>
    );
}
