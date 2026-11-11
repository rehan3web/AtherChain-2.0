import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, ShieldAlert, Lock, ArrowRight, UserCheck, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface RequirementProps {
    label: string;
    isMet: boolean;
    value: string;
    target: string;
    icon: React.ElementType;
    note?: string;
}

const RequirementItem: React.FC<RequirementProps> = ({ label, isMet, value, target, icon: Icon, note }) => (
    <div className={cn(
        "flex items-center justify-between p-5 border rounded-xl transition-all duration-300 backdrop-blur-md group",
        "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20",
        isMet ? "border-green-500/50" : "border-red-500/20"
    )}>
        <div className="flex items-center gap-4">
            <div className={cn("p-2 rounded-full", isMet ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                <Icon size={20} />
            </div>
            <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Current: <span className={isMet ? "text-green-500" : "text-red-500"}>{value}</span> / Required: {target}
                </p>
                {note && (
                    <p className="text-[10px] text-muted-foreground/60 italic mt-1 font-mono">
                        {note}
                    </p>
                )}
            </div>
        </div>
        <div>
            {isMet ? <CheckCircle2 className="text-green-500" size={20} /> : <XCircle className="text-red-500" size={20} />}
        </div>
    </div>
);

interface Props {
    eligibility: {
        eligible: boolean;
        reasons: string[];
        stats: {
            accountAgeDays: number;
            referralCount: number;
            minSessions?: number;
            emailVerified: boolean;
            twofaEnabled: boolean;
            isTwitterFollowed: boolean;
        };
        requirements: {
            min_account_age_days: number;
            min_referrals: number;
            require_email_verified: boolean;
            require_2fa: boolean;
            require_twitter_follow: boolean;
        };
    };
    onRefresh: () => void;
}

export const KYCRequirements: React.FC<Props> = ({ eligibility, onRefresh }) => {
    const { stats, requirements } = eligibility;
    const [verifyingTwitter, setVerifyingTwitter] = React.useState(false);
    const [twitterUsername, setTwitterUsername] = React.useState('');
    const [isVerifying, setIsVerifying] = React.useState(false);

    const handleVerifyTwitter = async () => {
        if (!twitterUsername) return alert('Please enter your X username');
        setIsVerifying(true);
        try {
            const api = (await import('@/lib/api')).default;
            await api.post('/user/kyc/verify-twitter', { twitter_username: twitterUsername });
            onRefresh();
            setVerifyingTwitter(false);
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to verify X account');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto space-y-8">
            <div className="text-center space-y-2">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
                    <Lock className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-3xl font-bold tracking-tight">KYC Verification Locked</h1>
                <p className="text-muted-foreground max-w-md mx-auto">
                    To ensure network integrity, you must meet the following criteria before submitting your identity verification.
                </p>
            </div>

            <div className="grid gap-4">
                <RequirementItem
                    label="Account Age"
                    isMet={stats.accountAgeDays >= requirements.min_account_age_days}
                    value={`${stats.accountAgeDays} Days`}
                    target={`${requirements.min_account_age_days} Days`}
                    icon={ClockIcon}
                />
                <RequirementItem
                    label="Referrals"
                    isMet={stats.referralCount >= requirements.min_referrals}
                    value={`${stats.referralCount} Users`}
                    target={`${requirements.min_referrals} Users`}
                    icon={UserCheck}
                    note={stats.minSessions ? `Each referral Must ${stats.minSessions} Times Mine Then Unlock This` : undefined}
                />
                <RequirementItem
                    label="Email Verification"
                    isMet={!requirements.require_email_verified || stats.emailVerified}
                    value={stats.emailVerified ? "Verified" : "Unverified"}
                    target="Verified"
                    icon={Mail}
                />
                <RequirementItem
                    label="Two-Factor Auth"
                    isMet={!requirements.require_2fa || stats.twofaEnabled}
                    value={stats.twofaEnabled ? "Enabled" : "Disabled"}
                    target="Enabled"
                    icon={ShieldCheck}
                />

                {requirements.require_twitter_follow && (
                    <div className={cn(
                        "flex flex-col p-5 border rounded-xl transition-all duration-300 backdrop-blur-md group",
                        "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20",
                        stats.isTwitterFollowed ? "border-green-500/50" : "border-red-500/20"
                    )}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={cn("p-2 rounded-full", stats.isTwitterFollowed ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-foreground">Follow X (Twitter)</p>
                                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                                        Follow @athchain to unlock KYC
                                    </p>
                                </div>
                            </div>
                            <div>
                                {stats.isTwitterFollowed ? (
                                    <CheckCircle2 className="text-green-500" size={20} />
                                ) : (
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-8 text-xs"
                                            onClick={() => window.open('https://x.com/athchain', '_blank')}
                                        >
                                            Follow
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="h-8 text-xs bg-foreground text-background"
                                            onClick={() => setVerifyingTwitter(true)}
                                        >
                                            Verify
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {verifyingTwitter && !stats.isTwitterFollowed && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="mt-4 pt-4 border-t border-red-900/20 space-y-3"
                            >
                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Enter your X Username</p>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="@username"
                                        value={twitterUsername}
                                        onChange={(e) => setTwitterUsername(e.target.value)}
                                        className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground"
                                    />
                                    <Button
                                        size="sm"
                                        disabled={isVerifying}
                                        onClick={handleVerifyTwitter}
                                        className="bg-foreground text-background"
                                    >
                                        {isVerifying ? "..." : "Confirm"}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setVerifyingTwitter(false)}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-center gap-4 pt-4">
                <Button
                    size="lg"
                    className="w-full h-14 text-lg"
                    onClick={onRefresh}
                    variant="outline"
                >
                    Refresh Status
                </Button>
            </div>



        </div>
    );
};

function ClockIcon(props: any) {
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
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    )
}
