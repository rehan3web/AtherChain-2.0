import { Router } from 'express';
import { AccountDeletionController } from '../controllers/accountDeletionController';

const router = Router();

// Public endpoints — No auth middleware required as they authenticate with credentials/OTP/deletion token
router.post('/request-otp', AccountDeletionController.requestOtp);
router.post('/resend-otp', AccountDeletionController.resendOtp);
router.post('/verify-otp', AccountDeletionController.verifyOtp);
router.post('/confirm', AccountDeletionController.confirmDeletion);
router.post('/cancel', AccountDeletionController.cancelDeletion);

export default router;

