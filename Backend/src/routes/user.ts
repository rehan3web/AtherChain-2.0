import { Router } from 'express';
import { getProfile, registerPushToken } from '../controllers/user';
import { auth } from '../middlewares/auth';
import { submitKyc, getKycStatus, getKycConfig, upload, verifyTwitterFollow } from '../controllers/kyc';
import { getDashboardStats, getUserStatistics } from '../controllers/dashboard';
import { AccountController, upload as profileUpload } from '../controllers/accountController';
import { TwoFactorController } from '../controllers/twoFactorController';
import { PasskeyController } from '../controllers/passkeyController';

const router = Router();

router.get('/me', auth, getProfile);
router.get('/dashboard/stats', auth, getDashboardStats);
router.get('/statistics', auth, getUserStatistics);

// Account Settings
router.put('/profile', auth, AccountController.updateProfile);
router.post('/profile/image', auth, profileUpload.single('image'), AccountController.uploadProfileImage);
router.delete('/profile/image', auth, AccountController.removeProfileImage);
router.put('/password', auth, AccountController.changePassword);

// Security (2FA)
router.post('/2fa/generate', auth, TwoFactorController.generateSecret); // This is just generating
router.post('/2fa/verify', auth, TwoFactorController.verifyEnable); // Confirm and enable
router.post('/2fa/disable', auth, TwoFactorController.disable);

// Security (Passkeys)
router.post('/passkey/register-options', auth, PasskeyController.generateRegisterOptions);
router.post('/passkey/register-verify', auth, PasskeyController.verifyRegister);
router.post('/passkey/remove', auth, PasskeyController.removePasskey);

// KYC
router.post('/push-token', auth, registerPushToken);
router.get('/kyc/status', auth, getKycStatus);

router.post('/kyc/verify-twitter', auth, verifyTwitterFollow);
router.get('/kyc/config', auth, getKycConfig);
router.post('/kyc/submit', auth, upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
]), submitKyc);


export default router;
