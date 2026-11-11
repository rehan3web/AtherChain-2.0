
import { query } from '../db/postgres';
import { SettingsModel } from '../models/settings';

interface KYCRules {
    active: boolean;
    require_email_verified: boolean;
    require_2fa: boolean;
    min_account_age_days: number;
    min_referrals: number;
    require_twitter_follow: boolean;
}

export class KYCService {
    static async getRules(): Promise<KYCRules> {
        const rules = await SettingsModel.get('kyc_rules') || {};
        return {
            active: rules.active ?? true,
            require_email_verified: rules.require_email_verified ?? true,
            require_2fa: rules.require_2fa ?? true,
            min_account_age_days: rules.min_account_age_days ?? parseInt(await SettingsModel.get('kyc_min_age_days') || '7'),
            min_referrals: rules.min_referrals ?? parseInt(await SettingsModel.get('kyc_min_referrals') || '10'),
            require_twitter_follow: rules.require_twitter_follow ?? ((await SettingsModel.get('kyc_require_twitter') || 'true') === 'true')
        };
    }

    static async checkEligibility(userId: string) {
        const rules = await this.getRules();
        const cycleHours = parseInt(await SettingsModel.get('mining_cycle_hours') || '24');
        const targetSessions = cycleHours === 12 ? 15 : 7;

        if (!rules.active) {
            return { eligible: true, reasons: [] };
        }

        const userRes = await query(`
            SELECT 
                created_at, 
                is_email_verified, 
                twofa_enabled,
                kyc_activation_paid,
                kyc_activation_tx_hash,
                is_twitter_followed,
                (SELECT COUNT(*) FROM users WHERE referred_by = $1 AND mining_sessions_count >= $2) as referral_count
            FROM users 
            WHERE id = $3
        `, [userId, targetSessions, userId]);

        const user = userRes.rows[0];
        if (!user) throw new Error('User not found');

        const reasons: string[] = [];
        const accountAgeDays = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);

        if (rules.require_email_verified && !user.is_email_verified) {
            reasons.push('Email Verification Required');
        }

        if (rules.require_2fa && !user.twofa_enabled) {
            reasons.push('Two-Factor Authentication Required');
        }

        if (accountAgeDays < rules.min_account_age_days) {
            reasons.push(`Account Age: ${Math.floor(accountAgeDays)}/${rules.min_account_age_days} Days`);
        }

        if (parseInt(user.referral_count) < rules.min_referrals) {
            reasons.push(`Referrals: ${user.referral_count}/${rules.min_referrals} Required`);
        }

        if (rules.require_twitter_follow && !user.is_twitter_followed) {
            reasons.push('Twitter Follow Required');
        }

        return {
            eligible: reasons.length === 0,
            reasons,
            stats: {
                accountAgeDays: Math.floor(accountAgeDays),
                referralCount: parseInt(user.referral_count),
                emailVerified: user.is_email_verified,
                twofaEnabled: user.twofa_enabled,
                minSessions: targetSessions,
                isTwitterFollowed: user.is_twitter_followed || false
            },
            requirements: rules
        };
    }

    static async updateRules(newRules: Partial<KYCRules>) {
        const current = await this.getRules();
        const updated = { ...current, ...newRules };
        await SettingsModel.set('kyc_rules', updated);
        return updated;
    }
}
