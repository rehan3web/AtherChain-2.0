'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, FileText, Clock, ChevronLeft, ArrowRight, ShieldCheck, Zap, Users, Lock, AlertTriangle, Info, Mail } from 'lucide-react';
import Link from 'next/link';

const Section = ({ title, icon: Icon, children, index }: { title: string, icon: any, children: React.ReactNode, index: number }) => (
    <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1 }}
        className="relative group"
    >
        <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20 group-hover:ring-purple-500/40 transition-all">
                <Icon size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground/90 group-hover:text-foreground transition-colors">
                {index}. {title}
            </h2>
        </div>
        <div className="text-muted-foreground leading-relaxed space-y-4 pl-1">
            {children}
        </div>
    </motion.section>
);

export default function TermsPage() {
    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-purple-500/30">
            {/* Background Grid */}
            <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
            <div className="fixed inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none" />

            <div className="relative max-w-4xl mx-auto px-6 py-20">
                {/* Header */}
                <header className="mb-20 text-center space-y-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-mono uppercase tracking-[0.2em] text-purple-400 mb-4"
                    >
                        Legal Documentation
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl md:text-6xl font-black tracking-tighter"
                    >
                        AtherChain <span className="text-muted-foreground/40">Terms & Conditions</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-sm font-mono text-muted-foreground uppercase tracking-widest flex items-center justify-center gap-2"
                    >
                        <Clock size={14} /> Last Updated: March 2026
                    </motion.p>
                </header>

                {/* Main Content */}
                <div className="space-y-16">
                    <section className="p-8 rounded-2xl bg-muted/20 border border-border/50 backdrop-blur-xl mb-12">
                        <p className="text-lg leading-relaxed text-muted-foreground italic">
                            Welcome to AtherChain. By accessing or using our platform, you agree to comply with and be bound by the following Terms and Conditions.
                        </p>
                    </section>

                    <Section title="Introduction" icon={Info} index={1}>
                        <p>
                            AtherChain is a blockchain-based platform operating on a Proof of Authority (PoA) consensus model, offering server-based mining services. No personal device hardware (mobile or PC) is required for mining.
                        </p>
                    </Section>

                    <Section title="Eligibility" icon={ShieldCheck} index={2}>
                        <ul className="space-y-3 list-disc list-inside">
                            <li>Be at least 18 years old</li>
                            <li>Provide accurate and complete information</li>
                            <li>Successfully complete KYC (Know Your Customer) verification</li>
                        </ul>
                    </Section>

                    <Section title="Account Registration & Security" icon={Lock} index={3}>
                        <div className="space-y-4">
                            <p>Users must:</p>
                            <ul className="space-y-3 list-disc list-inside">
                                <li>Verify their email address</li>
                                <li>Enable Two-Factor Authentication (2FA) (recommended/mandatory for certain actions)</li>
                                <li>Maintain account security (password, passkeys, etc.)</li>
                            </ul>
                            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 mt-4">
                                <p className="font-bold text-sm text-foreground mb-2">AtherChain supports:</p>
                                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                    <li className="flex items-center gap-2 italic">▹ Passkeys (Biometric login)</li>
                                    <li className="flex items-center gap-2 italic">▹ Device/session management</li>
                                    <li className="flex items-center gap-2 italic">▹ Logout from all devices feature</li>
                                </ul>
                            </div>
                            <p className="text-sm italic border-l-2 border-purple-500/30 pl-4 py-1">
                                You are responsible for all activities under your account.
                            </p>
                        </div>
                    </Section>

                    <Section title="KYC Verification Policy (Mandatory)" icon={Shield} index={4}>
                        <div className="space-y-6">
                            <p>Full platform access requires successful KYC verification.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-foreground/80">Requirements:</h3>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-start gap-2">▹ Valid government-issued ID</li>
                                        <li className="flex items-start gap-2">▹ Live verification (real-time detection)</li>
                                        <li className="flex items-start gap-2">▹ Email and 2FA Verification</li>
                                        <li className="flex items-start gap-2">▹ Minimum account age requirement</li>
                                        <li className="flex items-start gap-2">▹ Minimum 2 referrals requirement</li>
                                    </ul>
                                </div>
                                <div className="space-y-3">
                                    <h3 className="font-bold text-sm uppercase tracking-widest text-foreground/80">Restrictions:</h3>
                                    <ul className="space-y-2 text-sm">
                                        <li className="flex items-start gap-2">▹ Limited access for non-KYC users</li>
                                        <li className="flex items-start gap-2">▹ KYC required for Swap & Migration</li>
                                        <li className="flex items-start gap-2">▹ Full mining rewards locked until verified</li>
                                    </ul>
                                </div>
                            </div>
                            <p className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg text-xs text-red-400">
                                AtherChain reserves the right to reject or revoke verification if fraud is suspected.
                            </p>
                        </div>
                    </Section>

                    <Section title="Mining System" icon={Zap} index={5}>
                        <ul className="space-y-3">
                            <li className="flex gap-3">
                                <span className="text-purple-500 font-bold">●</span>
                                Mining is server-based, not dependent on user hardware.
                            </li>
                            <li className="flex gap-3">
                                <span className="text-purple-500 font-bold">●</span>
                                Users activate mining through platform allocation.
                            </li>
                            <li className="flex gap-3">
                                <span className="text-purple-500 font-bold">●</span>
                                Mining rewards are subject to system performance, network conditions, and platform compliance.
                            </li>
                        </ul>
                    </Section>

                    <Section title="Referral Program Policy" icon={Users} index={6}>
                        <div className="space-y-4">
                            <p className="font-bold text-foreground underline decoration-purple-500 underline-offset-4">
                                Minimum 2 referrals required for activation eligibility.
                            </p>
                            <p>A referral is considered valid only if:</p>
                            <ul className="space-y-2 text-sm">
                                <li>1. The referred user completes KYC</li>
                                <li>2. The referred user performs at least 15 mining sessions</li>
                            </ul>
                            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-bold uppercase">
                                <AlertTriangle size={14} />
                                Fake or self-referrals will result in account suspension.
                            </div>
                        </div>
                    </Section>

                    <Section title="Activation Fee" icon={FileText} index={7}>
                        <div className="space-y-4">
                            <div className="p-6 border border-purple-500/20 bg-purple-500/5 rounded-2xl flex items-center justify-between">
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground font-mono">One-time Fee</p>
                                    <p className="text-3xl font-black text-foreground">15 ATH <span className="text-sm font-light opacity-50 text-muted-foreground">Tokens</span></p>
                                </div>
                                <ShieldCheck className="text-purple-500 h-12 w-12 opacity-50" />
                            </div>
                            <ul className="space-y-2 text-sm italic opacity-80">
                                <li>▹ Verifies your mining server access</li>
                                <li>▹ Is non-refundable</li>
                                <li>▹ May change based on system upgrades</li>
                            </ul>
                        </div>
                    </Section>

                    <Section title="Transactions, Fees & Gas" icon={Shield} index={8}>
                        <p>AtherChain operates with ultra-low gas fees. All blockchain transactions are final and non-reversible. Users are responsible for verifying transaction details.</p>
                    </Section>

                    <Section title="Market Data Disclaimer" icon={Info} index={9}>
                        <p>AtherChain provides live market data aggregated from global exchanges. Prices (e.g., BTC, ETH, SOL, etc.) are informational only. AtherChain is not responsible for trading losses, market fluctuations, or inaccuracies.</p>
                    </Section>

                    <Section title="Security Measures" icon={Lock} index={10}>
                        <div className="space-y-4">
                            <p>We implement multi-layer authentication, session tracking, and real-time fraud detection. However, users must keep credentials secure and avoid sharing account access.</p>
                        </div>
                    </Section>

                    <Section title="Prohibited Activities" icon={AlertTriangle} index={11}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm bg-muted/30 p-6 rounded-xl border border-border/50 transition-all hover:bg-muted/40">
                            <ul className="space-y-2">
                                <li className="text-foreground font-bold uppercase tracking-tighter mb-2">PROHIBITED:</li>
                                <li>▹ Fake identity or KYC</li>
                                <li>▹ Exploiting referral system</li>
                                <li>▹ Hacking, botting, or abuse</li>
                                <li>▹ Creating multiple accounts</li>
                            </ul>
                            <ul className="space-y-2">
                                <li className="text-red-500 font-bold uppercase tracking-tighter mb-2">CONSEQUENCES:</li>
                                <li>▹ Account suspension</li>
                                <li>▹ Asset restriction</li>
                                <li>▹ Permanent ban</li>
                            </ul>
                        </div>
                    </Section>

                    <Section title="Suspension & Termination" icon={XIcon} index={12}>
                        <p>AtherChain reserves the right to suspend accounts without prior notice and restrict services for compliance reasons or terminate accounts involved in suspicious activity.</p>
                    </Section>

                    <Section title="Limitation of Liability" icon={ShieldCheck} index={13}>
                        <p className="italic border-l-2 border-muted pl-4">AtherChain is not liable for financial losses, market risks, technical downtime, or blockchain network issues. Use the platform at your own risk.</p>
                    </Section>

                    <Section title="Updates to Terms" icon={Clock} index={14}>
                        <p>We may update these Terms at any time. Continued use of the platform means you accept the updated Terms.</p>
                    </Section>

                    <Section title="Support System" icon={Mail} index={15}>
                        <p>Users can contact support via the Ticket Management System on the platform dashboard.</p>
                    </Section>

                    <Section title="Governing Law" icon={Shield} index={16}>
                        <p>These Terms are governed by applicable international blockchain and digital asset regulations.</p>
                    </Section>
                </div>

                {/* Footer Actions */}
                <footer className="mt-32 pt-12 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-8">
                    <Link href="/login">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-2 px-6 py-3 rounded-full border border-border bg-background hover:bg-muted transition-all text-sm font-bold uppercase tracking-widest"
                        >
                            <ChevronLeft size={16} /> Back to Entry
                        </motion.button>
                    </Link>

                    <div className="flex flex-col items-center md:items-end gap-2">
                        <p className="text-xs text-muted-foreground font-mono uppercase tracking-[0.3em]">Ready to start mining?</p>
                        <Link href="/dashboard">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="flex items-center gap-2 px-8 py-4 rounded-full bg-foreground text-background font-bold uppercase tracking-[0.2em] shadow-2xl shadow-purple-500/20"
                            >
                                Dashboard <ArrowRight size={18} />
                            </motion.button>
                        </Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}

function XIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}
