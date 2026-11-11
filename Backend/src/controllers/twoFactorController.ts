import { Request, Response } from 'express';
import pool from '../db/postgres';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { UserModel } from '../models/user';

export const TwoFactorController = {

    // Generate Secret & QR Code
    generateSecret: async (req: Request, res: Response) => {
        // @ts-ignore
        const userId = req.user.id;
        try {
            const user = await UserModel.findById(userId);
            const username = user?.username || 'User';

            const secret = speakeasy.generateSecret({
                name: `Ather Network: ${username}`
            });

            // Store temporary secret for verification (this is NOT enabled yet!)
            // We should ideally store this temporarily.
            // For simplicity, we can update the user directly but mark 'enabled' as false.

            await pool.query(
                'UPDATE users SET twofa_secret = $1 WHERE id = $2',
                [secret.base32, userId]
            );

            if (!secret.otpauth_url) {
                return res.status(500).json({ message: 'Error generating OTP URL' });
            }

            // Generate QR Code
            qrcode.toDataURL(secret.otpauth_url, (err, data_url) => {
                if (err) {
                    return res.status(500).json({ message: 'Error generating QR code' });
                }
                res.json({ secret: secret.base32, qrCode: data_url });
            });

        } catch (error) {
            console.error('2FA Generate Error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Verify OTP to Enable 2FA
    verifyEnable: async (req: Request, res: Response) => {
        // @ts-ignore
        const userId = req.user.id;
        const { token } = req.body;

        try {
            const userRes = await pool.query('SELECT twofa_secret FROM users WHERE id = $1', [userId]);
            const user = userRes.rows[0];

            if (!user || !user.twofa_secret) {
                return res.status(400).json({ message: '2FA setup not initiated' });
            }

            const verified = speakeasy.totp.verify({
                secret: user.twofa_secret,
                encoding: 'base32',
                token: token
            });

            if (verified) {
                await pool.query('UPDATE users SET twofa_enabled = TRUE WHERE id = $1', [userId]);
                res.json({ message: '2FA Enabled Successfully' });
            } else {
                res.status(400).json({ message: 'Invalid OTP Token' });
            }

        } catch (error) {
            console.error('2FA Verify Error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // Disable 2FA
    disable: async (req: Request, res: Response) => {
        // @ts-ignore
        const userId = req.user.id;
        const { token } = req.body;

        try {
            const userRes = await pool.query('SELECT twofa_secret, twofa_enabled FROM users WHERE id = $1', [userId]);
            const user = userRes.rows[0];

            if (!user.twofa_enabled) {
                return res.status(400).json({ message: '2FA is not enabled' });
            }

            const verified = speakeasy.totp.verify({
                secret: user.twofa_secret,
                encoding: 'base32',
                token: token
            });

            if (verified) {
                await pool.query('UPDATE users SET twofa_enabled = FALSE, twofa_secret = NULL WHERE id = $1', [userId]);
                res.json({ message: '2FA Disabled Successfully' });
            } else {
                res.status(400).json({ message: 'Invalid OTP Token' });
            }

        } catch (error) {
            console.error('2FA Disable Error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
};
