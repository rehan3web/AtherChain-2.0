import { Request, Response } from 'express';
import { z } from 'zod';
import { AccountDeletionService } from '../services/accountDeletionService';

const requestOtpSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
});

const resendOtpSchema = z.object({
    challengeId: z.string().uuid('Invalid challenge identifier'),
});

const verifyOtpSchema = z.object({
    challengeId: z.string().uuid('Invalid challenge identifier'),
    otp: z.string().regex(/^\d{6}$/, 'OTP must be a 6-digit number'),
});

const confirmSchema = z.object({
    deletionAuthorizationToken: z.string().min(10, 'Invalid deletion authorization token'),
    confirmationAccepted: z.boolean().refine((val) => val === true, {
        message: 'You must check the confirmation box to proceed.',
    }),
});

const cancelSchema = z.object({
    challengeId: z.string().uuid().optional(),
    deletionAuthorizationToken: z.string().optional(),
}).refine(data => data.challengeId || data.deletionAuthorizationToken, {
    message: 'Either challengeId or deletionAuthorizationToken is required',
});

function getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
}

export const AccountDeletionController = {
    /**
     * POST /account-deletion/request-otp
     */
    requestOtp: async (req: Request, res: Response) => {
        try {
            const parsed = requestOtpSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    message: parsed.error.issues[0]?.message || 'Invalid input data',
                });
            }

            const ip = getClientIp(req);
            const userAgent = req.headers['user-agent'] || 'Unknown';

            const result = await AccountDeletionService.requestOtp({
                email: parsed.data.email,
                password: parsed.data.password,
                ip,
                userAgent,
            });

            return res.status(200).json(result);
        } catch (error: any) {
            console.error('AccountDeletionController.requestOtp error:', error);
            const status = error.statusCode || 500;
            const message = error.message || 'Internal server error';
            return res.status(status).json({
                success: false,
                message,
                retryAfter: error.retryAfter,
            });
        }
    },

    /**
     * POST /account-deletion/resend-otp
     */
    resendOtp: async (req: Request, res: Response) => {
        try {
            const parsed = resendOtpSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    message: parsed.error.issues[0]?.message || 'Invalid input data',
                });
            }

            const ip = getClientIp(req);
            const result = await AccountDeletionService.resendOtp(parsed.data.challengeId, ip);
            return res.status(200).json(result);
        } catch (error: any) {
            console.error('AccountDeletionController.resendOtp error:', error);
            const status = error.statusCode || 500;
            const message = error.message || 'Internal server error';
            return res.status(status).json({
                success: false,
                message,
                retryAfter: error.retryAfter,
            });
        }
    },

    /**
     * POST /account-deletion/verify-otp
     */
    verifyOtp: async (req: Request, res: Response) => {
        try {
            const parsed = verifyOtpSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    message: parsed.error.issues[0]?.message || 'Invalid input data',
                });
            }

            const result = await AccountDeletionService.verifyOtp(
                parsed.data.challengeId,
                parsed.data.otp
            );

            return res.status(200).json(result);
        } catch (error: any) {
            console.error('AccountDeletionController.verifyOtp error:', error);
            const status = error.statusCode || 400;
            const message = error.message || 'Verification failed';
            return res.status(status).json({
                success: false,
                message,
                expired: error.expired,
                remainingAttempts: error.remainingAttempts,
            });
        }
    },

    /**
     * POST /account-deletion/confirm
     */
    confirmDeletion: async (req: Request, res: Response) => {
        try {
            const parsed = confirmSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    message: parsed.error.issues[0]?.message || 'Invalid confirmation data',
                });
            }

            const result = await AccountDeletionService.confirmAndExecuteDeletion(
                parsed.data.deletionAuthorizationToken,
                parsed.data.confirmationAccepted
            );

            return res.status(200).json(result);
        } catch (error: any) {
            console.error('AccountDeletionController.confirmDeletion error:', error);
            const status = error.statusCode || 500;
            const message = error.message || 'Failed to complete account deletion';
            return res.status(status).json({
                success: false,
                message,
            });
        }
    },

    /**
     * POST /account-deletion/cancel
     */
    cancelDeletion: async (req: Request, res: Response) => {
        try {
            const parsed = cancelSchema.safeParse(req.body);
            if (!parsed.success) {
                return res.status(400).json({
                    success: false,
                    message: parsed.error.issues[0]?.message || 'Invalid cancel request',
                });
            }

            const result = await AccountDeletionService.cancelDeletion(parsed.data);
            return res.status(200).json(result);
        } catch (error: any) {
            console.error('AccountDeletionController.cancelDeletion error:', error);
            const status = error.statusCode || 500;
            const message = error.message || 'Failed to cancel deletion request';
            return res.status(status).json({
                success: false,
                message,
            });
        }
    },
};
