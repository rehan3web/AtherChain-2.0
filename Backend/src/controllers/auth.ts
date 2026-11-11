import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import { v4 as uuidv4 } from 'uuid';
import { UserModel } from '../models/user';
import { env } from '../config/env';
import redis from '../db/redis';
import { query } from '../db/postgres';
import { ReferralController } from './referral';

import { emailService } from '../services/emailService';

import { FingerprintModel } from '../models/fingerprint';

export const register = async (req: Request, res: Response) => {
    try {
        const { firstName, lastName, username, email, phone, password, referralCode, visitorId, deviceId, fingerprintComponents, country } = req.body;

        // 1. Device Fingerprint Validation
        const actualVisitorId = deviceId || visitorId;

        if (!actualVisitorId) {
            return res.status(400).json({ message: 'Device verification failed (missing identifier). Please refresh and try again.' });
        }

        // 2. Check Blacklist
        const isBlacklisted = await redis.get(`blacklist:${actualVisitorId}`);
        if (isBlacklisted) {
            return res.status(403).json({ message: 'Your device has been blocked due to suspicious activity.' });
        }

        // 3. Rate Limiting (Registration Attempts)
        const attemptsKey = `reg_attempts:${actualVisitorId}`;
        const attempts = await redis.incr(attemptsKey);
        if (attempts === 1) {
            await redis.expire(attemptsKey, 3600); // 1 hour
        }

        if (attempts > 5) {
            // Block for 24 hours
            await redis.setex(`blacklist:${actualVisitorId}`, 24 * 60 * 60, 'true');
            return res.status(429).json({ message: 'Too many registration attempts. Your device is temporarily blocked.' });
        }

        // 4. Account Limit Check
        const accountCount = await FingerprintModel.countAccounts(actualVisitorId);
        const limit = env.ALLOW_MULTIPLE_ACCOUNTS ? 1000 : 3;

        if (accountCount >= limit) {
            return res.status(403).json({ message: 'You cannot create multiple accounts from this device.' });
        }

        // Check existing User
        const existingEmail = await UserModel.findByEmail(email);
        if (existingEmail) return res.status(400).json({ message: 'Email already registered' });

        const existingUser = await UserModel.findByUsername(username);
        if (existingUser) return res.status(400).json({ message: 'Username taken' });

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        console.log('Creating user...');
        // Pass OTP data to model
        const user = await UserModel.create({ firstName, lastName, username, email, phone, password, referredByCode: referralCode, otp, otpExpires, country });
        console.log('User created:', user.id);

        // 5. Store Fingerprint
        const userAgent = req.headers['user-agent'] || 'Unknown';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';

        await FingerprintModel.create({
            visitor_id: actualVisitorId,
            user_id: user.id,
            ip_address: String(ip),
            user_agent: userAgent,
            device_type: 'Unknown',
            browser: fingerprintComponents?.vendor?.value || 'Unknown',
            os: fingerprintComponents?.platform?.value || 'Unknown',
            screen_resolution: fingerprintComponents?.screenResolution?.value ?
                `${fingerprintComponents.screenResolution.value[0]}x${fingerprintComponents.screenResolution.value[1]}` : 'Unknown',
            components_json: fingerprintComponents || {}
        });

        // Send OTP Email
        await emailService.sendOTP(email, otp);

        // Trigger Referral Reward (if referred_by exists)
        // MOVED TO MINING: Referrer gets reward when user mines for the first time
        // if (user.referred_by) {
        //     ReferralController.applyReward(user.referred_by, user.id, 'registration');
        // }

        res.status(201).json({ message: 'User registered successfully. Please verify your email.', userId: user.id });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { emailOrUsername, password } = req.body;
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';

        let user = await UserModel.findByEmail(emailOrUsername);
        if (!user) {
            user = await UserModel.findByUsername(emailOrUsername);
        }

        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        // Check Blocked Status
        if (user.is_blocked) {
            return res.status(403).json({
                message: 'Your account has been blocked',
                code: 'USER_BLOCKED'
            });
        }

        // 0. Check Lockout
        const isLocked = await redis.get(`lock_login:${user.id}`);
        if (isLocked) {
            return res.status(429).json({ message: 'Too many failed attempts. Please wait 15 minutes and verify your email before trying again.' });
        }

        // Email Verification Check (General)
        if (!user.is_email_verified) {
            return res.status(403).json({ message: 'Email not verified', code: 'EMAIL_NOT_VERIFIED', userId: user.id, email: user.email });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);

        // Handle Failed Attempt
        if (!isMatch) {
            const failedKey = `failed_login:${user.id}`;
            const failedAttempts = await redis.incr(failedKey);

            if (failedAttempts === 1) {
                await redis.expire(failedKey, 24 * 60 * 60); // 24 hours
            }

            // Rule 2: 8 Wrong attempts -> Lock
            if (failedAttempts >= 8) {
                await redis.setex(`lock_login:${user.id}`, 15 * 60, 'true'); // 15 mins
                return res.status(429).json({ message: 'Too many failed attempts. Please wait 15 minutes and verify your email before trying again.' });
            }

            // Rule 1: 3 Wrong attempts -> Suspicious
            if (failedAttempts === 3) {
                await redis.set(`suspicious_activity:${user.id}`, 'true');
                return res.status(401).json({ message: 'Suspicious activity detected. Email verification is required before login.' });
            }

            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Handle Success - Check Suspicious Flag
        const isSuspicious = await redis.get(`suspicious_activity:${user.id}`);

        if (isSuspicious) {
            // Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

            await query('UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3', [otp, otpExpires, user.id]);
            await emailService.sendUnusualActivityOTP(user.email, otp);

            return res.status(200).json({
                message: 'Suspicious activity detected. Email verification is required before login.',
                requireEmailVerification: true,
                userId: user.id
            });
        }

        // Clear counters on successful, non-suspicious login
        await redis.del(`failed_login:${user.id}`);
        await redis.del(`suspicious_activity:${user.id}`);

        // Check Active Session Count
        const activeSessionsCount = await redis.scard(`user_sessions:${user.id}`);

        if (activeSessionsCount >= 2) {
            // Fetch details to show user
            const sessionIds = await redis.smembers(`user_sessions:${user.id}`);
            const sessions: any[] = [];
            for (const sid of sessionIds) {
                const sData = await redis.hgetall(`session:${sid}`);
                if (Object.keys(sData).length > 0) {
                    sessions.push({ id: sid, ...sData });
                } else {
                    await redis.srem(`user_sessions:${user.id}`, sid); // cleanup
                }
            }
            // Double check count after cleanup
            if (sessions.length >= 2) {
                // Generate a temporary token for session management
                const sessionManagementToken = jwt.sign(
                    { id: user.id, role: user.role, scope: 'session_management' },
                    env.JWT_SECRET,
                    { expiresIn: '10m' }
                );

                return res.status(403).json({
                    message: 'You cannot login on multiple devices. Only 2 active sessions are allowed.',
                    code: 'SESSION_LIMIT_EXCEEDED',
                    sessions: sessions,
                    sessionManagementToken: sessionManagementToken,
                    userId: user.id
                });
            }
        }

        // 2FA Check
        if (user.twofa_enabled) {
            return res.status(200).json({
                message: '2FA Verification Required',
                require2FA: true,
                userId: user.id
            });
        }

        // Generate Session ID
        const sessionId = uuidv4();

        const token = jwt.sign(
            { id: user.id, role: user.role, sessionId }, // Include sessionId
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Store Session in Redis
        const sessionData = {
            device: userAgent,
            ip: String(ip),
            location: 'Unknown', // You can implement IP geolocation here if needed
            loginTime: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            token: token // Optional, for reference
        };

        await redis.hmset(`session:${sessionId}`, sessionData);
        await redis.expire(`session:${sessionId}`, 7 * 24 * 60 * 60); // 7 days
        await redis.sadd(`user_sessions:${user.id}`, sessionId);

        // No need to set `session:{user.id}` anymore as we using specific session IDs
        // But for backward compatibility or simple checks, we might want to keep it? 
        // No, let's switch fully to new system.

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during login' });
    }
};

export const verify2FALogin = async (req: Request, res: Response) => {
    try {
        const { userId, token } = req.body;
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';

        const user = await UserModel.findById(userId);

        if (!user) return res.status(404).json({ message: 'User not found' });

        // Check Blocked Status
        if (user.is_blocked) {
            return res.status(403).json({
                message: 'Your account has been blocked',
                code: 'USER_BLOCKED'
            });
        }

        if (!user.twofa_enabled || !user.twofa_secret) return res.status(400).json({ message: '2FA not enabled for this user' });

        // Check Active Session Count
        const activeSessionsCount = await redis.scard(`user_sessions:${user.id}`);

        if (activeSessionsCount >= 2) {
            // Fetch details to show user
            const sessionIds = await redis.smembers(`user_sessions:${user.id}`);
            const sessions: any[] = [];
            for (const sid of sessionIds) {
                const sData = await redis.hgetall(`session:${sid}`);
                if (Object.keys(sData).length > 0) {
                    sessions.push({ id: sid, ...sData });
                } else {
                    await redis.srem(`user_sessions:${user.id}`, sid); // cleanup
                }
            }

            if (sessions.length >= 2) {
                return res.status(403).json({
                    message: 'You cannot login on multiple devices. Only 2 active sessions are allowed.',
                    code: 'SESSION_LIMIT_EXCEEDED',
                    sessions: sessions,
                    userId: user.id
                });
            }
        }

        const verified = speakeasy.totp.verify({
            secret: user.twofa_secret,
            encoding: 'base32',
            token: token,
            window: 2 // Allow +/- 60 seconds
        });

        if (!verified) return res.status(400).json({ message: 'Invalid OTP' });

        // Generate Session ID
        const sessionId = uuidv4();

        const jwtToken = jwt.sign(
            { id: user.id, role: user.role, sessionId },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Store Session in Redis
        const sessionData = {
            device: userAgent,
            ip: String(ip),
            location: 'Unknown',
            loginTime: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            token: jwtToken
        };

        await redis.hmset(`session:${sessionId}`, sessionData);
        await redis.expire(`session:${sessionId}`, 7 * 24 * 60 * 60);
        await redis.sadd(`user_sessions:${user.id}`, sessionId);

        res.json({ token: jwtToken, user: { id: user.id, username: user.username, role: user.role } });

    } catch (error) {
        console.error('2FA Login Error:', error);
        res.status(500).json({ message: 'Server error during 2FA verification' });
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        const user = await UserModel.findByEmail(email);

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.is_email_verified) return res.status(200).json({ message: 'Email already verified' });
        if (!user.otp_code || !user.otp_expires_at) return res.status(400).json({ message: 'Invalid OTP request' });

        if (new Date() > new Date(user.otp_expires_at)) {
            return res.status(400).json({ message: 'OTP expired' });
        }

        if (user.otp_code !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        // Verify User
        await query('UPDATE users SET is_email_verified = TRUE, otp_code = NULL, otp_expires_at = NULL WHERE id = $1', [user.id]);

        // Auto-login after verification: generate session & token
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';
        const sessionId = uuidv4();

        const token = jwt.sign(
            { id: user.id, role: user.role, sessionId },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const sessionData = {
            device: userAgent,
            ip: String(ip),
            location: 'Unknown',
            loginTime: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            token: token
        };

        await redis.hmset(`session:${sessionId}`, sessionData);
        await redis.expire(`session:${sessionId}`, 7 * 24 * 60 * 60);
        await redis.sadd(`user_sessions:${user.id}`, sessionId);

        res.json({
            message: 'Email verified successfully',
            token,
            user: { id: user.id, username: user.username, role: user.role }
        });

    } catch (error) {
        console.error('Verify Email Error:', error);
        res.status(500).json({ message: 'Verification failed' });
    }
};

export const resendOTP = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const user = await UserModel.findByEmail(email);

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.is_email_verified) return res.status(400).json({ message: 'Email already verified' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await query('UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3', [otp, otpExpires, user.id]);
        await emailService.sendOTP(email, otp);

        res.json({ message: 'OTP resent successfully' });

    } catch (error) {
        console.error('Resend OTP Error:', error);
        res.status(500).json({ message: 'Failed to resend OTP' });
    }
};

export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        const user = await UserModel.findByEmail(email);

        // Fail silently for security? Or give feedback?
        // Let's give feedback for now as per friendly UX request
        if (!user) return res.status(404).json({ message: 'User not found' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

        await query('UPDATE users SET reset_token = $1, reset_expires_at = $2 WHERE id = $3', [otp, expires, user.id]);

        await emailService.sendPasswordResetOTP(email, otp);

        res.json({ message: 'Password reset code sent to your email.' });
    } catch (error) {
        console.error('Forgot Password Error:', error);
        res.status(500).json({ message: 'Failed to process request' });
    }
};

export const verifyResetOTP = async (req: Request, res: Response) => {
    try {
        const { email, token } = req.body;
        const user = await UserModel.findByEmail(email);

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (!user.reset_token || user.reset_token !== token) return res.status(400).json({ message: 'Invalid verification code' });
        if (new Date() > new Date(user.reset_expires_at)) return res.status(400).json({ message: 'Token expired' });

        res.json({ message: 'Code verified successfully' });
    } catch (error) {
        console.error('Verify Reset OTP Error:', error);
        res.status(500).json({ message: 'Failed to verify code' });
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { email, token, newPassword } = req.body;
        const user = await UserModel.findByEmail(email);

        if (!user) return res.status(404).json({ message: 'User not found' });
        if (!user.reset_token || user.reset_token !== token) return res.status(400).json({ message: 'Invalid verification code' });
        if (new Date() > new Date(user.reset_expires_at)) return res.status(400).json({ message: 'Token expired' });

        const hash = await bcrypt.hash(newPassword, 10);
        await query('UPDATE users SET password_hash = $1, reset_token = NULL, reset_expires_at = NULL WHERE id = $2', [hash, user.id]);

        // Invalidate sessions
        await redis.del(`session:${user.id}`);

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ message: 'Failed to reset password' });
    }
};

export const verifySuspiciousLogin = async (req: Request, res: Response) => {
    try {
        const { userId, otp } = req.body;
        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Check Blocked Status
        if (user.is_blocked) {
            return res.status(403).json({
                message: 'Your account has been blocked',
                code: 'USER_BLOCKED'
            });
        }

        // Verify OTP
        if (!user.otp_code || !user.otp_expires_at) return res.status(400).json({ message: 'Invalid OTP request' });
        if (new Date() > new Date(user.otp_expires_at)) return res.status(400).json({ message: 'OTP expired' });
        if (user.otp_code !== otp) return res.status(400).json({ message: 'Invalid OTP' });

        // Verify Suspicious Flag exists? (Optional, but good for consistency)
        // const isSuspicious = await redis.get(`suspicious_activity:${user.id}`);
        // if (!isSuspicious) ... maybe they waited 24h?
        // Let's just proceed if OTP is valid.

        // Clear Flags
        await redis.del(`failed_login:${user.id}`);
        await redis.del(`suspicious_activity:${user.id}`);
        await query('UPDATE users SET otp_code = NULL, otp_expires_at = NULL WHERE id = $1', [user.id]);

        // Generate Session (Matched with Login Logic)
        // Check Active Session Count
        const activeSessionsCount = await redis.scard(`user_sessions:${user.id}`);

        if (activeSessionsCount >= 2) {
            const sessionIds = await redis.smembers(`user_sessions:${user.id}`);
            const sessions: any[] = [];
            for (const sid of sessionIds) {
                const sData = await redis.hgetall(`session:${sid}`);
                if (Object.keys(sData).length > 0) {
                    sessions.push({ id: sid, ...sData });
                } else {
                    await redis.srem(`user_sessions:${user.id}`, sid);
                }
            }
            if (sessions.length >= 2) {
                const sessionManagementToken = jwt.sign(
                    { id: user.id, role: user.role, scope: 'session_management' },
                    env.JWT_SECRET,
                    { expiresIn: '10m' }
                );
                return res.status(403).json({
                    message: 'You cannot login on multiple devices. Only 2 active sessions are allowed.',
                    code: 'SESSION_LIMIT_EXCEEDED',
                    sessions: sessions,
                    sessionManagementToken: sessionManagementToken,
                    userId: user.id
                });
            }
        }

        const sessionId = uuidv4();
        const token = jwt.sign(
            { id: user.id, role: user.role, sessionId },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const sessionData = {
            device: userAgent,
            ip: String(ip),
            location: 'Unknown',
            loginTime: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            token: token
        };

        await redis.hmset(`session:${sessionId}`, sessionData);
        await redis.expire(`session:${sessionId}`, 7 * 24 * 60 * 60);
        await redis.sadd(`user_sessions:${user.id}`, sessionId);

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });

    } catch (error) {
        console.error('Verify Suspicious Login Error:', error);
        res.status(500).json({ message: 'Server error during verification' });
    }
};

export const resendSuspiciousOTP = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        const user = await UserModel.findById(userId);

        if (!user) return res.status(404).json({ message: 'User not found' });

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await query('UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3', [otp, otpExpires, user.id]);
        await emailService.sendUnusualActivityOTP(user.email, otp);

        res.json({ message: 'OTP resent successfully' });

    } catch (error) {
        console.error('Resend Suspicious OTP Error:', error);
        res.status(500).json({ message: 'Failed to resend OTP' });
    }
};

export const start2FARecovery = async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ message: 'User ID is required' });

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Mask email: r***n@gmail.com
        const [local, domain] = user.email.split('@');
        const maskedLocal = local[0] + '*'.repeat(Math.max(1, local.length - 2)) + local[local.length - 1];
        const maskedEmail = `${maskedLocal}@${domain}`;

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        await query('UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3', [otp, otpExpires, user.id]);

        // Send Email
        await emailService.send2FAResetOTP(user.email, otp);

        res.json({
            message: 'Verification code sent to your email.',
            maskedEmail: maskedEmail
        });
    } catch (error) {
        console.error('Start 2FA Recovery Error:', error);
        res.status(500).json({ message: 'Failed to start recovery process' });
    }
};

export const verify2FARecovery = async (req: Request, res: Response) => {
    try {
        const { userId, otp } = req.body;
        if (!userId || !otp) return res.status(400).json({ message: 'User ID and OTP are required' });

        const user = await UserModel.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Verify OTP
        if (!user.otp_code || !user.otp_expires_at) return res.status(400).json({ message: 'No recovery request found' });
        if (new Date() > new Date(user.otp_expires_at)) return res.status(400).json({ message: 'OTP expired' });
        if (user.otp_code !== otp) return res.status(400).json({ message: 'Invalid OTP' });

        // Disable 2FA
        await query('UPDATE users SET twofa_enabled = FALSE, twofa_secret = NULL, otp_code = NULL, otp_expires_at = NULL WHERE id = $1', [user.id]);

        // The user can now login again normally. 
        // We could also auto-login here by generating a token.
        // Let's generate a token to make it smoother ("System automatically disables existing 2FA ... User session continues login").

        const userAgent = req.headers['user-agent'] || 'Unknown Device';
        const ip = req.ip || req.socket.remoteAddress || 'Unknown IP';
        const sessionId = uuidv4();
        const token = jwt.sign(
            { id: user.id, role: user.role, sessionId },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        const sessionData = {
            device: userAgent,
            ip: String(ip),
            location: 'Unknown',
            loginTime: new Date().toISOString(),
            lastActive: new Date().toISOString(),
            token: token
        };

        await redis.hmset(`session:${sessionId}`, sessionData);
        await redis.expire(`session:${sessionId}`, 7 * 24 * 60 * 60);
        await redis.sadd(`user_sessions:${user.id}`, sessionId);

        res.json({
            message: '2FA has been disabled. Login successful.',
            token: token,
            user: { id: user.id, username: user.username, role: user.role }
        });
    } catch (error) {
        console.error('Verify 2FA Recovery Error:', error);
        res.status(500).json({ message: 'Verification failed' });
    }
};

