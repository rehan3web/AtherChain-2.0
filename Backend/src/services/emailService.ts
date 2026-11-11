import nodemailer from 'nodemailer';
import { env } from '../config/env';

class EmailService {
    private transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: Number(process.env.EMAIL_PORT) || 587,
            secure: Number(process.env.EMAIL_PORT) === 465, // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });
    }

    private getBaseTemplate(title: string, message: string, body: string, otp: string, expiry: string, securityNote: string, color: string = '#00F0FF') {
        return `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 40px; background-color: #000000; color: #ffffff; border: 1px solid #1A1A1A; line-height: 1.6;">
                <div style="text-align: center; margin-bottom: 40px;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5em; text-transform: uppercase; italic: true; color: #ffffff;">ATHER NETWORK</h1>
                    <div style="height: 1px; background: linear-gradient(to right, transparent, ${color}, transparent); margin-top: 15px;"></div>
                </div>

                <div style="margin-bottom: 30px;">
                    <h2 style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: ${color}; margin-bottom: 10px;">${title}</h2>
                    <p style="font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; opacity: 0.8; margin: 0;">${message}</p>
                </div>

                <div style="margin-bottom: 30px;">
                    <p style="font-size: 13px; color: #888888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 20px;">${body}</p>
                    
                    <div style="background-color: #0A0A0A; border: 1px solid #1A1A1A; padding: 30px; text-align: center; position: relative;">
                        <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 0.3em; color: #ffffff; display: block;">${otp}</span>
                        <div style="position: absolute; top: 0; left: 0; padding: 5px 10px; background: #1A1A1A; font-size: 8px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.2em; color: #666;">Security_Key</div>
                    </div>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #1A1A1A;">
                    <p style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: ${color}; margin-bottom: 5px;">Expiry Window</p>
                    <p style="font-size: 12px; font-family: monospace; color: #666; margin: 0;">${expiry}</p>
                </div>

                <div style="margin-top: 40px; text-align: center;">
                    <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #444; margin-bottom: 15px;">${securityNote}</p>
                    <div style="display: inline-block; padding: 8px 15px; border: 1px solid #1A1A1A; font-size: 9px; font-family: monospace; text-transform: uppercase; letter-spacing: 0.3em; color: #555;">
                        Node-Auth-Protocol-v2.0
                    </div>
                </div>
            </div>
        `;
    }

    async sendAccountDeletionOTP(email: string, otp: string) {
        const mailOptions = {
            from: `"Ather Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `ACTION REQUIRED: Account Deletion Verification Code - Ather Network`,
            html: this.getBaseTemplate(
                "Account Deletion Verification",
                "Permanent Deletion Request Received",
                "A request has been initiated to permanently delete your Ather Network account. All your balances, mining logs, transactions, and profile data will be permanently wiped. To authorize this request, enter the verification code below:",
                otp,
                "This code expires strictly in 5 minutes.",
                "WARNING: If you did not request this deletion, change your password immediately and secure your account. Ather Support will NEVER ask for this code.",
                "#FF3344" // Alert Danger Red
            ),
        };
        return this.transporter.sendMail(mailOptions);
    }

    async sendUnusualActivityOTP(email: string, otp: string) {
        const mailOptions = {
            from: `"Ather Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Unusual Login Activity Detected - Ather Network`,
            html: this.getBaseTemplate(
                "Unusual Login Activity Detected",
                "We detected a login attempt from a new device or location.",
                "To secure your account, please use the verification code below.",
                otp,
                "This code will expire in 10 minutes.",
                "If this wasn’t you, please secure your account immediately.",
                "#FF3B3B" // Alert Red
            ),
        };
        return this.transporter.sendMail(mailOptions);
    }

    async send2FAResetOTP(email: string, otp: string) {
        const mailOptions = {
            from: `"Ather Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `2FA Reset Verification - Ather Network`,
            html: this.getBaseTemplate(
                "2FA Reset Verification",
                "You requested to reset your Two-Factor Authentication.",
                "To proceed with disabling your current 2FA, enter the verification code below.",
                otp,
                "This code will expire in 10 minutes.",
                "If you did not request this, please ignore this email.",
                "#00F0FF" // Standard Cyan
            ),
        };
        return this.transporter.sendMail(mailOptions);
    }

    async sendPasswordResetOTP(email: string, otp: string) {
        const mailOptions = {
            from: `"Ather Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Password Reset Verification - Ather Network`,
            html: this.getBaseTemplate(
                "Password Reset Verification",
                "We received a request to reset your password.",
                "Use the verification code below to continue resetting your password.",
                otp,
                "This code will expire in 10 minutes.",
                "If you did not request a password reset, your account remains secure.",
                "#FFFFFF" // Pure White/Reassuring
            ),
        };
        return this.transporter.sendMail(mailOptions);
    }

    async sendOTP(email: string, otp: string) {
        const mailOptions = {
            from: `"Ather Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Verify Your Email - Ather Network`,
            html: this.getBaseTemplate(
                "Verify Your Email",
                "Complete your account setup to start mining.",
                "Please use the verification code below to complete your registration:",
                otp,
                "This code will expire in 10 minutes.",
                "If you didn't request this, please ignore this email.",
                "#00F0FF"
            ),
        };
        return this.transporter.sendMail(mailOptions);
    }

    async sendPasswordReset(email: string, resetLink: string) {
        // Keeping the link version but with the new style if possible? 
        // Actually the user specifically asked for "Verification OTP" for password reset too now.
        // I'll keep this one original or update it if needed.
        const mailOptions = {
            from: `"Ather Security" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `Reset Your Password - Ather Network`,
            html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 40px; background-color: #000000; color: #ffffff; border: 1px solid #1A1A1A; line-height: 1.6; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5em; text-transform: uppercase; italic: true; color: #ffffff;">ATHER NETWORK</h1>
                     <div style="height: 1px; background: linear-gradient(to right, transparent, #00F0FF, transparent); margin: 20px 0;"></div>
                    
                    <h2 style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #00F0FF; margin-bottom: 10px;">Reset Your Password</h2>
                    <p style="font-size: 13px; color: #888888; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 30px;">We received a request to reset your password. Click the button below to proceed:</p>
                    
                    <div style="margin: 30px 0;">
                        <a href="${resetLink}" style="background-color: #00F0FF; color: #000; padding: 15px 40px; text-decoration: none; font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.2em; display: inline-block;">Reset Password</a>
                    </div>

                    <p style="font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: #444; margin-top: 40px;">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
                </div>
            `,
        };
        return this.transporter.sendMail(mailOptions);
    }
}

export const emailService = new EmailService();
