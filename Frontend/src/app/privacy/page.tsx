'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, FileText, Clock, ChevronLeft, ArrowRight, ShieldCheck, Zap, Users, Lock, AlertTriangle, Info, Mail, Eye, Server, Database, Globe } from 'lucide-react';
import Link from 'next/link';

const Section = ({ title, icon: Icon, children, index }: { title: string, icon: any, children: React.ReactNode, index: number }) => (
    <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: index * 0.1 }}
        className="relative group px-1"
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

export default function PrivacyPage() {
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
                        Consumer Data Privacy
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-5xl md:text-6xl font-black tracking-tighter"
                    >
                        AtherChain <span className="text-muted-foreground/40">Privacy Policy</span>
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
                            AtherChain (“we”, “our”, “us”) is committed to protecting your privacy and ensuring the security of your personal data. This Privacy Policy explains how we collect, use, store, and protect your information when you access or use the AtherChain platform.
                        </p>
                    </section>

                    <Section title="Information We Collect" icon={Database} index={1}>
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-foreground font-bold text-sm uppercase tracking-wider mb-3">1.1 Personal Information</h3>
                                <ul className="space-y-2 text-sm italic border-l border-purple-500/20 pl-4">
                                    <li>Full name</li>
                                    <li>Email address</li>
                                    <li>Account credentials</li>
                                    <li>Profile information</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-foreground font-bold text-sm uppercase tracking-wider mb-3">1.2 KYC & Identity Verification Data</h3>
                                <p className="text-sm mb-3">To enable full platform functionality and ensure compliance, we collect:</p>
                                <ul className="space-y-2 text-sm italic border-l border-purple-500/20 pl-4">
                                    <li>Government-issued identification (e.g., CNIC, passport)</li>
                                    <li>Live facial verification (liveness check)</li>
                                    <li>Identity verification results</li>
                                    <li>Account validation data</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-foreground font-bold text-sm uppercase tracking-wider mb-3">1.3 Technical & Device Information</h3>
                                <ul className="space-y-2 text-sm italic border-l border-purple-500/20 pl-4">
                                    <li>IP address</li>
                                    <li>Device type and operating system</li>
                                    <li>Browser information</li>
                                    <li>Login sessions and activity logs</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="text-foreground font-bold text-sm uppercase tracking-wider mb-3">1.4 Blockchain & Transaction Data</h3>
                                <ul className="space-y-2 text-sm italic border-l border-purple-500/20 pl-4">
                                    <li>Wallet addresses</li>
                                    <li>Transaction history</li>
                                    <li>Mining activity</li>
                                    <li>Token balances</li>
                                </ul>
                                <p className="mt-4 p-3 bg-red-500/5 border border-red-500/10 rounded text-xs text-red-400 font-bold uppercase tracking-tight">
                                    Note: Blockchain data is public, immutable, and cannot be deleted.
                                </p>
                            </div>
                        </div>
                    </Section>

                    <Section title="How We Use Your Information" icon={Zap} index={2}>
                        <ul className="space-y-3 list-disc list-inside">
                            <li>Verify identity (KYC compliance)</li>
                            <li>Provide server-based mining services</li>
                            <li>Enable secure features (Swap, Migration)</li>
                            <li>Prevent fraud, abuse, and unauthorized access</li>
                            <li>Improve system performance and user experience</li>
                            <li>Communicate important updates and security alerts</li>
                        </ul>
                    </Section>

                    <Section title="KYC & Compliance" icon={ShieldCheck} index={3}>
                        <div className="space-y-4">
                            <p className="font-bold underline decoration-purple-500 underline-offset-4 mb-4">KYC verification is mandatory for full access to AtherChain services.</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <h4 className="text-xs font-black uppercase mb-3 opacity-60">We use KYC data to:</h4>
                                    <ul className="space-y-2 text-sm">
                                        <li>▹ Ensure one-user-one-account policy</li>
                                        <li>▹ Detect duplicate or fraudulent accounts</li>
                                        <li>▹ Comply with regulatory standards</li>
                                    </ul>
                                </div>
                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                    <h4 className="text-xs font-black uppercase mb-3 text-red-400">We reserve the right to:</h4>
                                    <ul className="space-y-2 text-sm italic text-red-500/80">
                                        <li>▹ Reject verification requests</li>
                                        <li>▹ Suspend accounts with suspicious activity</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </Section>

                    <Section title="Data Sharing & Disclosure" icon={Users} index={4}>
                        <p className="font-bold text-foreground">We do not sell your personal data.</p>
                        <p>We may share data with:</p>
                        <ul className="space-y-2 text-sm italic border-l-2 border-purple-500/30 pl-4 py-2">
                            <li>▹ Trusted KYC/identity verification providers</li>
                            <li>▹ Security and fraud detection services</li>
                            <li>▹ Legal authorities when required by law</li>
                        </ul>
                        <p className="text-xs opacity-60 uppercase tracking-widest font-mono pt-4">All third-party services are required to maintain strict confidentiality.</p>
                    </Section>

                    <Section title="Data Security" icon={Lock} index={5}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ul className="space-y-3">
                                <li className="flex items-center gap-2">▹ Encryption of sensitive information</li>
                                <li className="flex items-center gap-2">▹ Two-Factor Authentication (2FA)</li>
                            </ul>
                            <ul className="space-y-3">
                                <li className="flex items-center gap-2">▹ Secure session & device management</li>
                                <li className="flex items-center gap-2">▹ Real-time monitoring & fraud detection</li>
                            </ul>
                        </div>
                        <p className="text-xs text-muted-foreground/60 italic pt-6">Despite our efforts, no system is completely secure.</p>
                    </Section>

                    <Section title="Data Retention" icon={Clock} index={6}>
                        <p>We retain your information as long as your account remains active and as required for legal, regulatory, and compliance purposes.</p>
                        <p className="p-4 rounded-lg bg-muted/50 border border-border text-sm font-bold">
                            KYC and verification data may be retained even after account closure.
                        </p>
                    </Section>

                    <Section title="Your Rights" icon={Shield} index={7}>
                        <ul className="space-y-2 list-disc list-inside mb-4">
                            <li>Access your personal data</li>
                            <li>Request corrections or updates</li>
                            <li>Request deletion of non-blockchain data</li>
                        </ul>
                        <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-lg text-xs text-red-400 font-bold uppercase tracking-widest flex items-center gap-2">
                            <AlertTriangle size={14} />
                            Important: Blockchain records cannot be altered or deleted.
                        </div>
                    </Section>

                    <Section title="Cookies & Tracking Technologies" icon={Eye} index={8}>
                        <p>We use cookies and similar technologies to maintain login sessions, enhance security, and improve platform functionality. Disabling cookies may limit certain features.</p>
                    </Section>

                    <Section title="Third-Party Services" icon={Globe} index={9}>
                        <p>We may use third-party providers for authentication (e.g., 2FA apps), analytics, and identity verification (KYC). We are not responsible for the privacy practices of third-party services.</p>
                    </Section>

                    <Section title="Children’s Privacy" icon={Users} index={10}>
                        <p className="italic underline decoration-purple-500/30 underline-offset-8">
                            AtherChain is not intended for individuals under the age of 18. We do not knowingly collect personal data from minors.
                        </p>
                    </Section>

                    <Section title="International Data Transfers" icon={Server} index={11}>
                        <p>Your information may be processed and stored on servers located in different countries. By using AtherChain, you consent to such data transfers.</p>
                    </Section>

                    <Section title="Updates to This Policy" icon={FileText} index={12}>
                        <p>We may update this Privacy Policy from time to time. Continued use of the platform after updates constitutes acceptance of the revised policy.</p>
                    </Section>

                    <Section title="Contact & Support" icon={Mail} index={13}>
                        <p>For privacy-related inquiries or requests, please contact us via the AtherChain Support Ticket System available in your dashboard.</p>
                    </Section>
                </div>

                {/* Footer Actions */}
                <footer className="mt-32 pt-12 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-8">
                    <Link href="/terms">
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="flex items-center gap-2 px-6 py-3 rounded-full border border-border bg-background hover:bg-muted transition-all text-sm font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                        >
                            <FileText size={16} /> Read Terms
                        </motion.button>
                    </Link>

                    <div className="flex flex-col items-center md:items-end gap-2">
                        <p className="text-xs text-muted-foreground font-mono uppercase tracking-[0.3em]">Privacy-First Mining</p>
                        <Link href="/login">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="flex items-center gap-2 px-8 py-4 rounded-full bg-foreground text-background font-bold uppercase tracking-[0.2em] shadow-2xl shadow-purple-500/20"
                            >
                                Secure Entry <ArrowRight size={18} />
                            </motion.button>
                        </Link>
                    </div>
                </footer>
            </div>
        </div>
    );
}
