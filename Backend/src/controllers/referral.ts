import { Request, Response } from 'express';
import { query, getClient } from '../db/postgres';
import { env } from '../config/env';
import { v4 as uuidv4 } from 'uuid';

export class ReferralController {

    /**
     * Fetch referral statistics and L1 tree for the logged-in user
     */
    static async getReferralStats(req: Request | any, res: Response) {
        try {
            const userId = req.user.id;

            // 1. Get referral code and basic summary
            const userRes = await query(
                `SELECT referral_code FROM users WHERE id = $1`,
                [userId]
            );
            const user = userRes.rows[0];

            // 2. Fetch L1 referral list (direct children)
            const referralsRes = await query(
                `SELECT username, kyc_status, created_at as join_date, last_mined_at, mining_days_count, mining_sessions_count 
                 FROM users 
                 WHERE referred_by = $1 
                 ORDER BY created_at DESC`,
                [userId]
            );

            // 3. Calculate total earnings from rewards log
            const earningsRes = await query(
                `SELECT SUM(amount) as total_earned FROM referral_rewards_log WHERE referrer_id = $1`,
                [userId]
            );
            const totalEarned = parseFloat(earningsRes.rows[0].total_earned) || 0;

            // 4. Get reward configuration
            const settingsRes = await query('SELECT registration_reward_at, kyc_verified_reward_at FROM referral_settings WHERE id = 1');
            const settings = settingsRes.rows[0] || { registration_reward_at: 10, kyc_verified_reward_at: 50 };

            // 5. Get Mining Cycle for dynamic progress
            const systemSettings = await query("SELECT key, value FROM system_settings WHERE key = 'mining_cycle_hours'");
            const cycleHours = parseInt(systemSettings.rows[0]?.value || '24');
            const targetSessions = cycleHours === 12 ? 15 : 7;

            const currentDate = new Date().toISOString().split('T')[0];
            const mappedReferrals = referralsRes.rows.map(r => {
                const lastMinedDate = r.last_mined_at ? new Date(r.last_mined_at).toISOString().split('T')[0] : null;
                const activityStatus = lastMinedDate === currentDate ? 'Active' : 'Inactive';
                return {
                    ...r,
                    activity_status: activityStatus,
                    mining_progress: `${r.mining_sessions_count || 0}/${targetSessions}`
                };
            });

            const origin = req.headers.origin || (env.FRONTEND_URL[0]);

            res.json({
                referralCode: user.referral_code,
                referralLink: `${origin}/register?ref=${user.referral_code}`,
                totalReferrals: referralsRes.rows.length,
                totalEarned,
                referrals: mappedReferrals,
                mining_cycle_hours: cycleHours,
                config: {
                    unverifiedReward: parseFloat(settings.registration_reward_at),
                    verifiedReward: parseFloat(settings.kyc_verified_reward_at)
                },
                // Node data for the Tree UI
                tree: {
                    name: 'You',
                    children: mappedReferrals.map(r => ({
                        name: r.username,
                        status: r.kyc_status,
                        joinDate: r.join_date,
                        activityStatus: r.activity_status,
                        progress: r.mining_progress
                    }))
                }
            });

        } catch (error) {
            console.error('getReferralStats error:', error);
            res.status(500).json({ message: 'Failed to fetch referral intelligence' });
        }
    }

    /**
     * Apply a referral reward (atomic)
     * Internal function called by Auth / KYC controllers
     */
    static async applyReward(referrerId: string, referredId: string, type: 'registration' | 'kyc') {
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // 1. Get reward amount from settings
            const settingsRes = await client.query('SELECT registration_reward_at, kyc_verified_reward_at FROM referral_settings WHERE id = 1');
            const settings = settingsRes.rows[0];
            const amount = type === 'registration' ? settings.registration_reward_at : settings.kyc_verified_reward_at;

            // 2. Prevent self-referral or missing amount
            if (!amount || parseFloat(amount) <= 0) {
                await client.query('ROLLBACK');
                return;
            }

            // 3. Check if reward already applied (Postgres UNIQUE constraint will also handle this)
            const checkRes = await client.query(
                `SELECT id FROM referral_rewards_log WHERE referred_id = $1 AND type = $2`,
                [referredId, type]
            );
            if (checkRes.rows.length > 0) {
                await client.query('ROLLBACK');
                return;
            }

            // 4. Update Referrer's AT Balance
            const updateRes = await client.query(
                `UPDATE users SET at_balance = at_balance + $1 WHERE id = $2 RETURNING at_balance`,
                [amount, referrerId]
            );

            if (updateRes.rowCount === 0) {
                await client.query('ROLLBACK');
                return;
            }

            // 5. Log reward for audit
            await client.query(
                `INSERT INTO referral_rewards_log (referrer_id, referred_id, type, amount)
                 VALUES ($1, $2, $3, $4)`,
                [referrerId, referredId, type, amount]
            );

            await client.query('COMMIT');
            console.log(`[REFERRAL] Applied ${type} reward of ${amount} AT to referrer ${referrerId}`);

        } catch (error: any) {
            await client.query('ROLLBACK');
            console.error(`[REFERRAL] ApplyReward ${type} failed:`, error.message);
        } finally {
            client.release();
        }
    }

    /**
     * Admin: Get referral settings
     */
    static async getAdminSettings(req: Request, res: Response) {
        try {
            const resData = await query('SELECT * FROM referral_settings WHERE id = 1');
            res.json(resData.rows[0]);
        } catch (error) {
            res.status(500).json({ message: 'Failed to fetch settings' });
        }
    }

    /**
     * Admin: Update referral settings
     */
    static async updateAdminSettings(req: Request, res: Response) {
        try {
            const { registrationReward, kycReward } = req.body;
            await query(
                `UPDATE referral_settings 
                 SET registration_reward_at = $1, kyc_verified_reward_at = $2, updated_at = NOW() 
                 WHERE id = 1`,
                [registrationReward, kycReward]
            );
            res.json({ message: 'Referral settings updated successfully' });
        } catch (error) {
            res.status(500).json({ message: 'Update failed' });
        }
    }
}
