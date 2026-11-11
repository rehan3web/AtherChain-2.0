import { Request, Response } from 'express';
import pool from '../db/postgres';
import {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { env } from '../config/env';
import redis from '../db/redis';

// Human-readable title for your website
const rpName = 'Ather Network';

// Helper to get dynamic RP ID and Origin
const getWebAuthnConfig = (req: Request) => {
    // Priority: env.RP_ID > req.host (stripped of port)
    const rpID = env.RP_ID || req.get('host')?.split(':')[0] || 'localhost';

    // Use the actual Origin header if available, fallback to a constructed one
    const webOrigin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
    
    // Support additional passkey origins from environment variables (e.g. Android/iOS app origins)
    const additionalOrigins = env.EXPECTED_PASSKEY_ORIGINS || [];
    
    const origin = Array.from(new Set([webOrigin, ...additionalOrigins]));
    return { rpID, origin };
};

export const PasskeyController = {

    // 1. Generate Registration Options
    generateRegisterOptions: async (req: Request, res: Response) => {
        // @ts-ignore
        const user = req.user;

        try {
            const { rpID } = getWebAuthnConfig(req);

            // Check if user already has passkeys
            const userPasskeys = await pool.query('SELECT username, first_name, last_name, passkey_credentials FROM users WHERE id = $1', [user.id]);
            const userData = userPasskeys.rows[0];
            const existingPasskeys = userData?.passkey_credentials || [];
            const username = userData?.username || 'User';
            const displayName = userData?.full_name || `${userData?.first_name || ''} ${userData?.last_name || ''}`.trim() || username;

            console.log(`[Passkey] Generating registration options for ${username} (RP: ${rpID})`);

            const options: any = await generateRegistrationOptions({
                rpName,
                rpID,
                userID: Uint8Array.from(Buffer.from(user.id)),
                userName: username,
                userDisplayName: displayName,
                // Pass the IDs as strings (base64url) which the library handles correctly
                excludeCredentials: existingPasskeys
                    .filter((cred: any) => cred.id)
                    .map((cred: any) => ({
                        id: cred.id,
                        transports: cred.transports,
                    })),
                authenticatorSelection: {
                    residentKey: 'preferred',
                    userVerification: 'preferred',
                    // Note: Removing authenticatorAttachment restriction to be most compatible
                },
            });

            // Store challenge in Redis as base64url string
            const challengeBase64 = Buffer.from(options.challenge).toString('base64url');
            await redis.set(`challenge:${user.id}`, challengeBase64, 'EX', 60 * 5); // 5 mins

            // Convert binary fields to base64url for JSON transport
            const jsonSafeOptions = {
                ...options,
                challenge: challengeBase64,
                user: {
                    ...options.user,
                    // options.user.id is already Buffer/Uint8Array from our input
                    id: Buffer.from(options.user.id).toString('base64url')
                },
                excludeCredentials: options.excludeCredentials?.map((cred: any) => ({
                    ...cred,
                    // If the library returned Uint8Array, convert to string
                    id: typeof cred.id === 'string' ? cred.id : Buffer.from(cred.id).toString('base64url')
                }))
            };

            console.log('[Passkey] Registration options ready');
            res.json(jsonSafeOptions);
        } catch (error: any) {
            console.error('[Passkey Error] Registration Options:', error);
            res.status(500).json({ message: 'Failed to generate registration options', error: error.message });
        }
    },

    // 2. Verify Registration
    verifyRegister: async (req: Request, res: Response) => {
        // @ts-ignore
        const user = req.user;
        const { body } = req;

        try {
            const { rpID, origin } = getWebAuthnConfig(req);

            // Retrieve challenge
            const expectedChallenge = await redis.get(`challenge:${user.id}`);
            if (!expectedChallenge) {
                return res.status(400).json({ message: 'Challenge expired or not found' });
            }

            console.log(`[Passkey] Verifying registration for ${user.id} (RP: ${rpID})`);

            let verification;
            try {
                verification = await verifyRegistrationResponse({
                    response: body,
                    expectedChallenge,
                    expectedOrigin: origin,
                    expectedRPID: rpID,
                });
            } catch (error: any) {
                console.error('[Passkey Error] Registration Verification:', error);
                return res.status(400).json({ message: 'Verification failed', error: error.message });
            }

            const { verified, registrationInfo } = verification;

            if (verified && registrationInfo) {
                const { id: credentialID, publicKey: credentialPublicKey, counter } = registrationInfo.credential;

                // Save to DB
                // We need to append to the existing JSONB array
                const newCredential = {
                    id: credentialID,
                    publicKey: Buffer.from(credentialPublicKey).toString('base64'), // Store as base64 for JSON
                    counter,
                    transports: body.response.transports,
                };

                await pool.query(
                    `UPDATE users 
                     SET passkey_credentials = COALESCE(passkey_credentials, '[]'::jsonb) || $1::jsonb,
                         passkey_enabled = TRUE
                     WHERE id = $2`,
                    [JSON.stringify(newCredential), user.id]
                );

                // Clear challenge
                await redis.del(`challenge:${user.id}`);

                res.json({ verified: true });
            } else {
                res.status(400).json({ verified: false, message: 'Verification failed' });
            }

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error during verification' });
        }
    },

    // 3. Generate Auth Options (Login)
    generateAuthOptions: async (req: Request, res: Response) => {
        // Passkey login usually is initiated with just a username/email or autofill.
        // If autofill (conditional UI), we don't need username yet.
        // But let's assume user enters email first? Or clicks "Login with Passkey".
        // If "Login with Passkey", we might not know the user yet if they use resident key.
        // But for this implementation, let's assume we know the user (e.g. from email step) OR we do the "discoverable credential" flow.

        // Let's implement the simpler flow first: User enters email, we check if passkey enabled, if so, we verify.
        const { email, username: providedUsername } = req.body;
        const identity = email || providedUsername;
        console.log(`[Passkey] Login Options. Identity: ${identity}`);

        try {
            const { rpID } = getWebAuthnConfig(req);

            let user = null;
            if (identity) {
                // Check both columns with the same value
                const userRes = await pool.query(
                    'SELECT * FROM users WHERE email = $1 OR username = $1',
                    [identity]
                );
                user = userRes.rows[0];
                console.log(`[Passkey] User search result:`, user ? `Found (${user.username})` : `Not Found for ${identity}`);
            }

            const userPasskeys = user ? (user.passkey_credentials || []) : [];

            console.log(`[Passkey] Generating auth options for ${identity || 'unknown'} (RP: ${rpID})`);

            const options = await generateAuthenticationOptions({
                rpID,
                // Pass IDs as strings (base64url)
                allowCredentials: userPasskeys
                    .filter((cred: any) => cred.id)
                    .map((cred: any) => ({
                        id: cred.id,
                        transports: cred.transports,
                    })),
                userVerification: 'preferred',
            });

            const challengeBase64 = Buffer.from(options.challenge).toString('base64url');
            if (user) {
                await redis.set(`challenge:${user.id}`, challengeBase64, 'EX', 60 * 5);
            }

            // Convert binary fields to base64url for JSON transport
            const jsonSafeOptions = {
                ...options,
                challenge: challengeBase64,
                allowCredentials: options.allowCredentials?.map((cred: any) => ({
                    ...cred,
                    id: typeof cred.id === 'string' ? cred.id : Buffer.from(cred.id).toString('base64url')
                }))
            };

            res.json(jsonSafeOptions);

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Failed to generate auth options' });
        }
    },

    // 4. Verify Auth (Login)
    verifyAuth: async (req: Request, res: Response) => {
        const { body } = req;
        const { default: redis } = await import('../db/redis');

        try {
            const { rpID, origin } = getWebAuthnConfig(req);
            const { userId, email, username: providedUsername } = req.body;
            const identity = email || providedUsername;
            console.log(`[Passkey] Login Verify. Identity: ${identity}, UserId: ${userId}`);

            let user;
            if (userId) {
                const res = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
                user = res.rows[0];
            } else if (identity) {
                const res = await pool.query(
                    'SELECT * FROM users WHERE email = $1 OR username = $1',
                    [identity]
                );
                user = res.rows[0];
            }
            console.log(`[Passkey] Verify User Context:`, user ? `Found (${user.username})` : `Not Found for ID: ${identity || userId}`);

            if (!user) return res.status(400).json({ message: 'User not identified' });

            // Check Blocked Status
            if (user.is_blocked) {
                return res.status(403).json({
                    message: 'Your account has been blocked',
                    code: 'USER_BLOCKED'
                });
            }

            const expectedChallenge = await redis.get(`challenge:${user.id}`);
            if (!expectedChallenge) return res.status(400).json({ message: 'Challenge expired' });

            const currentCredential = user.passkey_credentials.find((cred: any) => cred.id === body.id);
            if (!currentCredential) {
                console.warn(`[Passkey] Credential ${body.id} not found for user ${user.username}`);
                return res.status(400).json({ message: 'This passkey does not belong to this account' });
            }

            console.log(`[Passkey] Verifying auth for ${user.id} (RP: ${rpID})`);

            let verification;
            try {
                verification = await verifyAuthenticationResponse({
                    response: body,
                    expectedChallenge,
                    expectedOrigin: origin,
                    expectedRPID: rpID,
                    credential: {
                        id: currentCredential.id,
                        publicKey: Buffer.from(currentCredential.publicKey, 'base64'),
                        counter: currentCredential.counter,
                        transports: currentCredential.transports,
                    }
                });
            } catch (error: any) {
                console.error('[Passkey Error] Auth Verification:', error);
                return res.status(400).json({ message: 'Verification failed', error: error.message });
            }

            const { verified, authenticationInfo } = verification;

            if (verified) {
                // Update counter
                const newCounter = authenticationInfo.newCounter;

                const updatedCredentials = user.passkey_credentials.map((cred: any) => {
                    if (cred.id === body.id) {
                        return { ...cred, counter: newCounter };
                    }
                    return cred;
                });

                await pool.query('UPDATE users SET passkey_credentials = $1 WHERE id = $2', [JSON.stringify(updatedCredentials), user.id]);
                await redis.del(`challenge:${user.id}`);

                // Generate JWT (Login Success)
                const { default: jwt } = await import('jsonwebtoken');
                const token = jwt.sign(
                    { id: user.id, role: user.role },
                    env.JWT_SECRET,
                    { expiresIn: '7d' }
                );

                // Cache session
                await redis.set(`session:${user.id}`, token, 'EX', 7 * 24 * 60 * 60);

                res.json({ verified: true, token, user: { id: user.id, username: user.username, role: user.role } });
            } else {
                res.status(400).json({ verified: false });
            }

        } catch (error) {
            console.error(error);
            res.status(500).json({ message: 'Server error' });
        }
    },

    // 5. Remove Passkey
    removePasskey: async (req: Request, res: Response) => {
        // @ts-ignore
        const user = req.user;
        const { credentialID } = req.body;

        if (!credentialID) return res.status(400).json({ message: 'Credential ID required' });

        try {
            const userRes = await pool.query('SELECT passkey_credentials FROM users WHERE id = $1', [user.id]);
            const credentials = userRes.rows[0]?.passkey_credentials || [];

            const updatedCredentials = credentials.filter((cred: any) => cred.id !== credentialID);

            await pool.query(
                `UPDATE users 
                 SET passkey_credentials = $1,
                     passkey_enabled = $2
                 WHERE id = $3`,
                [JSON.stringify(updatedCredentials), updatedCredentials.length > 0, user.id]
            );

            console.log(`[Passkey] Removed credential ${credentialID} for user ${user.id}`);
            res.json({ message: 'Passkey removed successfully' });
        } catch (error) {
            console.error('[Passkey Error] Remove:', error);
            res.status(500).json({ message: 'Failed to remove passkey' });
        }
    }
};
