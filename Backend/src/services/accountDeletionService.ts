import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import pool, { query } from '../db/postgres';
import redis from '../db/redis';
import { env } from '../config/env';
import { emailService } from './emailService';
import MiningLog from '../models/MiningLog';
import Transaction from '../models/Transaction';
import mongoose from 'mongoose';

// Pre-computed dummy hash to prevent timing attacks when an email is not found
const DUMMY_HASH = '$2a$10$7EqJtq98hPqEX7fNZaFWoO.Q9v5K2B9P6w3I6rN5y8qY0qO4eZ9re';

let tableReady = false;

export async function ensureDeletionTableExists() {
    if (tableReady) return;
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS account_deletion_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                otp_hash VARCHAR(255) NOT NULL,
                otp_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                attempts INT DEFAULT 0,
                max_attempts INT DEFAULT 5,
                resend_count INT DEFAULT 0,
                last_resend_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                auth_token_hash VARCHAR(255),
                auth_token_expires_at TIMESTAMP WITH TIME ZONE,
                status VARCHAR(50) DEFAULT 'pending_otp',
                ip_address VARCHAR(45),
                user_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_account_deletion_user_id ON account_deletion_requests(user_id);
            CREATE INDEX IF NOT EXISTS idx_account_deletion_status ON account_deletion_requests(status);
            CREATE INDEX IF NOT EXISTS idx_account_deletion_auth_token_hash ON account_deletion_requests(auth_token_hash);
        `);
        tableReady = true;
    } catch (error) {
        console.error('Error ensuring account_deletion_requests table exists:', error);
    }
}

function hashSecret(value: string): string {
    return crypto.createHmac('sha256', env.JWT_SECRET).update(value).digest('hex');
}

export function maskEmail(email: string): string {
    const parts = email.split('@');
    if (parts.length !== 2) return '***';
    const [local, domain] = parts;
    if (local.length <= 2) {
        return `${local[0]}***@${domain}`;
    }
    const visibleStart = local.slice(0, 1);
    const visibleEnd = local.slice(-1);
    const masked = '*'.repeat(Math.max(3, local.length - 2));
    return `${visibleStart}${masked}${visibleEnd}@${domain}`;
}

async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    try {
        const hits = await redis.incr(key);
        if (hits === 1) {
            await redis.expire(key, windowSeconds);
        }
        return hits <= limit;
    } catch (e) {
        // Fail open if Redis is momentarily unavailable
        console.warn('Redis rate limit check failed, allowing request:', e);
        return true;
    }
}

export const AccountDeletionService = {
    /**
     * Step 1: Verify credentials and issue OTP
     */
    requestOtp: async (data: { email: string; password: string; ip: string; userAgent: string }) => {
        await ensureDeletionTableExists();

        const normalizedEmail = data.email.trim().toLowerCase();

        // 1. IP rate limiting (max 10 requests per 15 minutes)
        const ipAllowed = await checkRateLimit(`del_rate_ip:${data.ip}`, 10, 15 * 60);
        if (!ipAllowed) {
            const err: any = new Error('Too many requests from this IP. Please try again later.');
            err.statusCode = 429;
            throw err;
        }

        // 2. Email rate limiting (max 5 requests per 15 minutes)
        const emailAllowed = await checkRateLimit(`del_rate_email:${normalizedEmail}`, 5, 15 * 60);
        if (!emailAllowed) {
            const err: any = new Error('Too many requests for this account. Please try again later.');
            err.statusCode = 429;
            throw err;
        }

        // 3. User lookup
        const userRes = await query(
            'SELECT id, email, password_hash, is_blocked FROM users WHERE LOWER(email) = LOWER($1)',
            [normalizedEmail]
        );

        if (userRes.rows.length === 0) {
            // Constant-time dummy comparison to prevent email enumeration
            await bcrypt.compare(data.password, DUMMY_HASH);
            const err: any = new Error('Invalid email or password.');
            err.statusCode = 400;
            throw err;
        }

        const user = userRes.rows[0];

        // 4. Verify password
        const passwordMatches = await bcrypt.compare(data.password, user.password_hash);
        if (!passwordMatches) {
            const err: any = new Error('Invalid email or password.');
            err.statusCode = 400;
            throw err;
        }

        if (user.is_blocked) {
            const err: any = new Error('Account is blocked. Please contact support.');
            err.statusCode = 403;
            throw err;
        }

        // 5. Cooldown check against active challenges (minimum 60s cooldown)
        const activeRes = await query(
            `SELECT id, last_resend_at, created_at 
             FROM account_deletion_requests 
             WHERE user_id = $1 AND status = 'pending_otp' 
             ORDER BY created_at DESC LIMIT 1`,
            [user.id]
        );

        if (activeRes.rows.length > 0) {
            const lastTime = new Date(activeRes.rows[0].last_resend_at || activeRes.rows[0].created_at).getTime();
            const elapsedSeconds = Math.floor((Date.now() - lastTime) / 1000);
            if (elapsedSeconds < 60) {
                const retryAfter = 60 - elapsedSeconds;
                const err: any = new Error(`Please wait ${retryAfter} seconds before requesting a new code.`);
                err.statusCode = 429;
                err.retryAfter = retryAfter;
                throw err;
            }

            // Invalidate older pending challenges
            await query(
                `UPDATE account_deletion_requests SET status = 'cancelled', updated_at = NOW() 
                 WHERE user_id = $1 AND status = 'pending_otp'`,
                [user.id]
            );
        }

        // 6. Generate cryptographically secure 6-digit OTP
        const otpNum = crypto.randomInt(100000, 1000000);
        const otpStr = otpNum.toString();
        const otpHash = hashSecret(otpStr);
        const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // 7. Save challenge to DB
        const insertRes = await query(
            `INSERT INTO account_deletion_requests 
                (user_id, email, otp_hash, otp_expires_at, attempts, max_attempts, status, ip_address, user_agent, last_resend_at)
             VALUES ($1, $2, $3, $4, 0, 5, 'pending_otp', $5, $6, NOW())
             RETURNING id`,
            [user.id, user.email, otpHash, otpExpiresAt, data.ip, data.userAgent]
        );

        const challengeId = insertRes.rows[0].id;

        // 8. Send OTP to registered email
        try {
            await emailService.sendAccountDeletionOTP(user.email, otpStr);
        } catch (mailError) {
            console.error('Failed to send account deletion email:', mailError);
            // We do not fail the request if mail delivery had a transient issue, but log it
        }

        return {
            success: true,
            message: 'A 6-digit verification code has been sent to your registered email.',
            maskedEmail: maskEmail(user.email),
            challengeId,
        };
    },

    /**
     * Resend OTP for an existing pending challenge
     */
    resendOtp: async (challengeId: string, ip: string) => {
        await ensureDeletionTableExists();

        const res = await query(
            `SELECT * FROM account_deletion_requests WHERE id = $1 AND status = 'pending_otp'`,
            [challengeId]
        );

        if (res.rows.length === 0) {
            const err: any = new Error('Active deletion challenge not found or already verified. Please request a new code.');
            err.statusCode = 400;
            throw err;
        }

        const challenge = res.rows[0];

        // 1. Resend limit check (max 5 resends per challenge)
        if (challenge.resend_count >= 5) {
            await query(
                `UPDATE account_deletion_requests SET status = 'locked', updated_at = NOW() WHERE id = $1`,
                [challengeId]
            );
            const err: any = new Error('Maximum resend attempts reached. Please start over.');
            err.statusCode = 429;
            throw err;
        }

        // 2. Cooldown check (60s)
        const lastResendTime = new Date(challenge.last_resend_at || challenge.created_at).getTime();
        const elapsed = Math.floor((Date.now() - lastResendTime) / 1000);
        if (elapsed < 60) {
            const retryAfter = 60 - elapsed;
            const err: any = new Error(`Please wait ${retryAfter} seconds before resending.`);
            err.statusCode = 429;
            err.retryAfter = retryAfter;
            throw err;
        }

        // 3. Generate new OTP & hash
        const otpNum = crypto.randomInt(100000, 1000000);
        const otpStr = otpNum.toString();
        const otpHash = hashSecret(otpStr);
        const newExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await query(
            `UPDATE account_deletion_requests 
             SET otp_hash = $1, 
                 otp_expires_at = $2, 
                 last_resend_at = NOW(), 
                 resend_count = resend_count + 1, 
                 attempts = 0, 
                 updated_at = NOW()
             WHERE id = $3`,
            [otpHash, newExpiry, challengeId]
        );

        // 4. Send email
        try {
            await emailService.sendAccountDeletionOTP(challenge.email, otpStr);
        } catch (mailError) {
            console.error('Failed to resend account deletion email:', mailError);
        }

        return {
            success: true,
            message: 'A new 6-digit verification code has been sent to your email.',
        };
    },

    /**
     * Step 2: Verify OTP and generate short-lived deletion authorization token
     */
    verifyOtp: async (challengeId: string, candidateOtp: string) => {
        await ensureDeletionTableExists();

        const cleanOtp = candidateOtp.trim();
        if (!/^\d{6}$/.test(cleanOtp)) {
            const err: any = new Error('Invalid verification code format. Must be a 6-digit code.');
            err.statusCode = 400;
            throw err;
        }

        const res = await query(
            `SELECT * FROM account_deletion_requests WHERE id = $1 AND status = 'pending_otp'`,
            [challengeId]
        );

        if (res.rows.length === 0) {
            const err: any = new Error('Deletion challenge not found, expired, or already processed.');
            err.statusCode = 400;
            throw err;
        }

        const challenge = res.rows[0];

        // Check if locked
        if (challenge.attempts >= challenge.max_attempts) {
            await query(
                `UPDATE account_deletion_requests SET status = 'locked', updated_at = NOW() WHERE id = $1`,
                [challengeId]
            );
            const err: any = new Error('Too many invalid attempts. Deletion request has been locked for your security.');
            err.statusCode = 429;
            throw err;
        }

        // Check expiration
        if (new Date() > new Date(challenge.otp_expires_at)) {
            const err: any = new Error('The verification code has expired. Please request a new code.');
            err.statusCode = 400;
            err.expired = true;
            throw err;
        }

        // Compare OTP hashes using constant-time timingSafeEqual
        const candidateHash = hashSecret(cleanOtp);
        const candidateBuffer = Buffer.from(candidateHash, 'hex');
        const storedBuffer = Buffer.from(challenge.otp_hash, 'hex');

        let isMatch = false;
        if (candidateBuffer.length === storedBuffer.length) {
            isMatch = crypto.timingSafeEqual(candidateBuffer, storedBuffer);
        }

        if (!isMatch) {
            const updatedRes = await query(
                `UPDATE account_deletion_requests 
                 SET attempts = attempts + 1, updated_at = NOW() 
                 WHERE id = $1 
                 RETURNING attempts, max_attempts`,
                [challengeId]
            );
            const attempts = updatedRes.rows[0]?.attempts || challenge.attempts + 1;
            const remaining = Math.max(0, challenge.max_attempts - attempts);

            if (remaining === 0) {
                await query(
                    `UPDATE account_deletion_requests SET status = 'locked', updated_at = NOW() WHERE id = $1`,
                    [challengeId]
                );
                const err: any = new Error('Too many invalid attempts. Deletion request has been locked.');
                err.statusCode = 429;
                throw err;
            }

            const err: any = new Error(`Invalid verification code. ${remaining} attempt(s) remaining.`);
            err.statusCode = 400;
            err.remainingAttempts = remaining;
            throw err;
        }

        // OTP is correct! Issue short-lived, single-purpose deletion authorization token
        const rawToken = 'del_' + crypto.randomBytes(32).toString('hex');
        const tokenHash = hashSecret(rawToken);
        const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes window for confirmation

        await query(
            `UPDATE account_deletion_requests 
             SET status = 'verified', 
                 auth_token_hash = $1, 
                 auth_token_expires_at = $2, 
                 updated_at = NOW() 
             WHERE id = $3`,
            [tokenHash, tokenExpiresAt, challengeId]
        );

        return {
            success: true,
            message: 'Email verification confirmed.',
            deletionAuthorizationToken: rawToken,
        };
    },

    /**
     * Cancel deletion request
     */
    cancelDeletion: async (identifier: { challengeId?: string; deletionAuthorizationToken?: string }) => {
        await ensureDeletionTableExists();

        if (identifier.challengeId) {
            await query(
                `UPDATE account_deletion_requests 
                 SET status = 'cancelled', updated_at = NOW() 
                 WHERE id = $1`,
                [identifier.challengeId]
            );
        } else if (identifier.deletionAuthorizationToken) {
            const tokenHash = hashSecret(identifier.deletionAuthorizationToken);
            await query(
                `UPDATE account_deletion_requests 
                 SET status = 'cancelled', updated_at = NOW() 
                 WHERE auth_token_hash = $1`,
                [tokenHash]
            );
        }

        return {
            success: true,
            message: 'Account deletion request has been safely cancelled.',
        };
    },

    /**
     * Step 4: Final permanent deletion execution
     */
    confirmAndExecuteDeletion: async (deletionAuthorizationToken: string, confirmationAccepted: boolean) => {
        await ensureDeletionTableExists();

        if (!confirmationAccepted) {
            const err: any = new Error('You must check the confirmation box acknowledging permanent deletion.');
            err.statusCode = 400;
            throw err;
        }

        const tokenHash = hashSecret(deletionAuthorizationToken);

        // Find verified challenge
        const challengeRes = await query(
            `SELECT * FROM account_deletion_requests 
             WHERE auth_token_hash = $1 AND status = 'verified'`,
            [tokenHash]
        );

        if (challengeRes.rows.length === 0) {
            const err: any = new Error('Invalid or already utilized deletion authorization token.');
            err.statusCode = 400;
            throw err;
        }

        const challenge = challengeRes.rows[0];
        const userId = challenge.user_id;

        // Check token expiration
        if (new Date() > new Date(challenge.auth_token_expires_at)) {
            await query(
                `UPDATE account_deletion_requests SET status = 'expired', updated_at = NOW() WHERE id = $1`,
                [challenge.id]
            );
            const err: any = new Error('Deletion authorization token has expired. Please restart the deletion process.');
            err.statusCode = 400;
            throw err;
        }

        // Concurrency lock in Redis to prevent race conditions
        const lockKey = `deletion_lock:${userId}`;
        let lockAcquired = false;
        try {
            const lockRes = await redis.set(lockKey, 'locked', 'PX', 60000, 'NX');
            lockAcquired = lockRes === 'OK';
        } catch {
            // If Redis is unreachable, fallback to DB-level locking
            lockAcquired = true;
        }

        if (!lockAcquired) {
            const err: any = new Error('Account deletion is already processing. Please wait.');
            err.statusCode = 409;
            throw err;
        }

        // Mark challenge as processing to prevent replay
        await query(
            `UPDATE account_deletion_requests SET status = 'processing', updated_at = NOW() WHERE id = $1`,
            [challenge.id]
        );

        const filesToDelete: string[] = [];
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // 1. Fetch user to verify existence and get profile image
            const userRes = await client.query(
                `SELECT id, email, profile_image FROM users WHERE id = $1 FOR UPDATE`,
                [userId]
            );

            if (userRes.rows.length === 0) {
                await client.query('COMMIT');
                // Account already gone
                return { success: true, message: 'Account has been permanently deleted.' };
            }

            const user = userRes.rows[0];
            if (user.profile_image) {
                filesToDelete.push(user.profile_image);
            }

            // 2. Fetch KYC document file paths and selfies
            const kycRequests = await client.query(
                `SELECT id, id_front_url, id_back_url, selfie_url, face_scan_frame 
                 FROM kyc_requests WHERE user_id = $1`,
                [userId]
            );

            for (const kr of kycRequests.rows) {
                if (kr.id_front_url) filesToDelete.push(kr.id_front_url);
                if (kr.id_back_url) filesToDelete.push(kr.id_back_url);
                if (kr.selfie_url) filesToDelete.push(kr.selfie_url);
                // face_scan_frame now stores a file path
                if (kr.face_scan_frame) filesToDelete.push(kr.face_scan_frame);

                const kycDocs = await client.query(
                    `SELECT file_path FROM kyc_documents WHERE request_id = $1`,
                    [kr.id]
                );
                for (const doc of kycDocs.rows) {
                    if (doc.file_path) filesToDelete.push(doc.file_path);
                }
            }

            // 3. Fetch support ticket and message attachments
            const supportTickets = await client.query(
                `SELECT image_url FROM support_tickets WHERE user_id = $1`,
                [userId]
            );
            for (const st of supportTickets.rows) {
                if (st.image_url) filesToDelete.push(st.image_url);
            }

            const supportMessages = await client.query(
                `SELECT image_url FROM ticket_messages WHERE sender_id = $1`,
                [userId]
            );
            for (const sm of supportMessages.rows) {
                if (sm.image_url) filesToDelete.push(sm.image_url);
            }

            // 4. Resolve dependencies without CASCADE:
            // a) Other users referred by this user: set referrer_id = NULL
            await client.query(
                `UPDATE users SET referrer_id = NULL WHERE referrer_id = $1`,
                [userId]
            );

            // b) referral_rewards_log: delete logs where this user is referrer or referred
            await client.query(
                `DELETE FROM referral_rewards_log WHERE referrer_id = $1 OR referred_id = $1`,
                [userId]
            );

            // c) admin_audit_logs: nullify target_user_id
            await client.query(
                `UPDATE admin_audit_logs SET target_user_id = NULL WHERE target_user_id = $1`,
                [userId]
            );

            // d) ticket_messages: nullify sender_id where user sent messages
            await client.query(
                `UPDATE ticket_messages SET sender_id = NULL WHERE sender_id = $1`,
                [userId]
            );

            // 5. Delete from users table!
            // All cascading account tables (wallets, kyc_requests, kyc_documents,
            // kyc_status_history, support_tickets, notification_reads, push_subscriptions,
            // device_fingerprints, account_deletion_requests) will be deleted automatically.
            await client.query(`DELETE FROM users WHERE id = $1`, [userId]);

            await client.query('COMMIT');
            console.log(`✅ Permanently deleted PostgreSQL records for user: ${userId}`);
        } catch (dbError) {
            await client.query('ROLLBACK');
            console.error('❌ Database transaction rollback during account deletion:', dbError);
            throw dbError;
        } finally {
            client.release();
        }

        // 6. Post-transaction MongoDB cleanup
        try {
            await Promise.allSettled([
                MiningLog.deleteMany({ userId: userId.toString() }),
                Transaction.deleteMany({ userId: userId.toString() }),
                // Retain account-erasure support for historical records.
                mongoose.connection.collection('claims').deleteMany({ userId: userId.toString() }),
            ]);
            console.log(`✅ Cleaned MongoDB records for user: ${userId}`);
        } catch (mongoError) {
            console.error('Warning: MongoDB cleanup encountered error:', mongoError);
        }

        // 7. Post-transaction Redis cleanup (sessions, tokens, rate limits)
        try {
            const sessionIds = await redis.smembers(`user_sessions:${userId}`);
            if (sessionIds && sessionIds.length > 0) {
                for (const sId of sessionIds) {
                    await redis.del(`session:${sId}`);
                }
            }
            await redis.del(`user_sessions:${userId}`);
            await redis.del(`session:${userId}`);
            await redis.del(`del_rate_email:${challenge.email.toLowerCase()}`);
            await redis.del(lockKey);
            console.log(`✅ Cleared all Redis sessions for user: ${userId}`);
        } catch (redisError) {
            console.error('Warning: Redis cleanup encountered error:', redisError);
        }

        // 8. Reliable file cleanup with retries
        for (const rawPath of filesToDelete) {
            if (!rawPath) continue;
            // Normalize path
            const relPath = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
            const fullPath = path.isAbsolute(rawPath) ? rawPath : path.join(process.cwd(), relPath);

            let deleted = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    if (fs.existsSync(fullPath)) {
                        fs.unlinkSync(fullPath);
                    }
                    deleted = true;
                    break;
                } catch (fsErr) {
                    if (attempt === 3) {
                        console.warn(`Could not delete file after 3 attempts (${fullPath}):`, fsErr);
                    }
                }
            }
        }

        return {
            success: true,
            message: 'Your account has been permanently deleted.',
        };
    },
};

