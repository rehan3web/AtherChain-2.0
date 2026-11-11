import { Router } from 'express';
import { register, login, verifyEmail, resendOTP, forgotPassword, verifyResetOTP, resetPassword, verify2FALogin, verifySuspiciousLogin, resendSuspiciousOTP, start2FARecovery, verify2FARecovery } from '../controllers/auth';
import { checkVersion } from '../controllers/appVersion';

import { PasskeyController } from '../controllers/passkeyController';
import { SessionController } from '../controllers/sessionController';
import { QRAuthController } from '../controllers/qrAuthController';
import { auth } from '../middlewares/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/check-version', checkVersion);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOTP);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOTP);
router.post('/reset-password', resetPassword);
router.post('/verify-2fa-login', verify2FALogin);
router.post('/verify-suspicious-login', verifySuspiciousLogin);
router.post('/resend-suspicious-otp', resendSuspiciousOTP);
router.post('/start-2fa-recovery', start2FARecovery);
router.post('/verify-2fa-recovery', verify2FARecovery);


// Passkey Authentication
router.post('/passkey/login-options', PasskeyController.generateAuthOptions);
router.post('/passkey/login-verify', PasskeyController.verifyAuth);

// QR Authentication Flow
router.post('/qr/create', QRAuthController.createSession);
router.get('/qr/status/:sessionId', QRAuthController.getStatus);
router.post('/qr/approve', auth, QRAuthController.approveSession);

// Session Management
router.get('/sessions', auth, SessionController.getActiveSessions);
router.delete('/sessions/:sessionId', auth, SessionController.removeSession);
router.delete('/sessions', auth, SessionController.removeAllSessions);

export default router;
