import pool, { query } from '../db/postgres';
import { WalletService } from '../services/wallet';
import bcrypt from 'bcryptjs';

export class UserModel {

    static async create(data: any) {
        const { firstName, lastName, username, email, phone, password, referredByCode, otp, otpExpires, country } = data;
        const passwordHash = await bcrypt.hash(password, 10);
        const referralCode = Math.random().toString(36).substring(2, 10).toUpperCase();

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Resolve referral code
            let referredBy = null;
            if (referredByCode) {
                const refRes = await client.query('SELECT id FROM users WHERE referral_code = $1', [referredByCode]);
                if (refRes.rows.length > 0) {
                    referredBy = refRes.rows[0].id;
                }
            }



            // 1. Create User
            const userRes = await client.query(
                `INSERT INTO users (first_name, last_name, username, email, phone, password_hash, referral_code, referred_by, at_balance, is_swap_enabled, is_mining_enabled, is_transfer_enabled, is_email_verified, otp_code, otp_expires_at, country)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, TRUE, TRUE, TRUE, FALSE, $9, $10, $11)
                 RETURNING id, email, username, role, at_balance, is_swap_enabled, is_mining_enabled, is_transfer_enabled, referred_by, country`,
                [firstName, lastName, username, email, phone, passwordHash, referralCode, referredBy, otp, otpExpires, country]
            );
            const user = userRes.rows[0];

            // 2. Create Wallet
            const { address } = await WalletService.createWallet();

            await client.query(
                `INSERT INTO wallets (user_id, address, balance_at, balance_ath)
                 VALUES ($1, $2, 0, 0)`,
                [user.id, address]
            );

            await client.query('COMMIT');
            return { ...user, walletAddress: address };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    static async findByEmail(email: string) {
        console.log('Finding by email:', email);
        const res = await query('SELECT * FROM users WHERE email = $1', [email]);
        console.log('Found by email:', res.rows.length);
        return res.rows[0];
    }

    static async findByUsername(username: string) {
        const res = await query('SELECT * FROM users WHERE username = $1', [username]);
        return res.rows[0];
    }

    static async findById(id: string) {
        const res = await query(
            `SELECT u.id, u.first_name, u.last_name, u.username, u.email, u.phone, u.role, u.kyc_status, u.referral_code, 
                    u.at_balance, u.is_swap_enabled, u.is_mining_enabled, u.is_transfer_enabled, 
                    u.full_name, u.country, u.profile_image, u.twofa_enabled, u.twofa_secret,
                    u.passkey_enabled, u.passkey_credentials, u.otp_code, u.otp_expires_at, u.next_swap_at,
                    u.mining_paused, u.swap_paused, u.transfer_paused, u.is_blocked,
                    u.mining_boost_claimed, u.mining_bonus_rate, u.current_cycle_boosts,
                    u.mining_reminders_enabled, u.last_reminder_sent_at, u.last_mined_at,
                    w.address, w.balance_ath
             FROM users u
             LEFT JOIN wallets w ON u.id = w.user_id
             WHERE u.id = $1`,
            [id]
        );
        return res.rows[0];
    }
}
