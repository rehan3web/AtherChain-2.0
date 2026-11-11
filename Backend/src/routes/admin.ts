import { Router } from 'express';
import { adminAuth } from '../middlewares/admin';
import { adminLogin } from '../controllers/adminAuth';
import { listUsers, updateUserStatus, updateUserBalance, getUserDetails, deleteUser, forceLogoutUser, editUser, resetUserPassword, getUserTransactions, recreateUserWallet, adminSendAssets, estimateAdminSendGas } from '../controllers/adminUser';
import { listKycRequests, getKycDetails, approveKyc, rejectKyc, serveKycDocument, serveFaceScan } from '../controllers/adminKyc';
import { getKycRules, updateKycRules } from '../controllers/kyc';
import { getSettings, updateSettings, updateBoostSettings } from '../controllers/adminSettings';
import { getDashboardStats, getSwapHistory } from '../controllers/adminStats';
import { sendBroadcast, testPush, triggerMiningReminders } from '../controllers/adminNotification';
import { ReferralController } from '../controllers/referral';
import { listVersions, addVersion, updateVersion, deleteVersion } from '../controllers/appVersion';

const router = Router();

// Auth
router.post('/login', adminLogin);

// Users
router.get('/users', adminAuth, listUsers);
router.get('/users/:userId', adminAuth, getUserDetails);
router.patch('/users/:userId', adminAuth, updateUserStatus);
router.post('/users/:userId/balance', adminAuth, updateUserBalance);
router.delete('/users/:userId', adminAuth, deleteUser);
router.post('/users/:userId/logout', adminAuth, forceLogoutUser);
router.put('/users/:userId', adminAuth, editUser);
router.post('/users/:userId/reset-password', adminAuth, resetUserPassword);
router.get('/users/:userId/transactions', adminAuth, getUserTransactions);
router.post('/users/:userId/wallet/recreate', adminAuth, recreateUserWallet);
router.post('/users/:userId/wallet/send', adminAuth, adminSendAssets);
router.post('/users/:userId/wallet/estimate-gas', adminAuth, estimateAdminSendGas);

// KYC
router.get('/kyc', adminAuth, listKycRequests);
router.get('/kyc/:requestId', adminAuth, getKycDetails);
router.post('/kyc/:requestId/approve', adminAuth, approveKyc);
router.post('/kyc/:requestId/reject', adminAuth, rejectKyc);
router.get('/kyc/document/:documentId', adminAuth, serveKycDocument);
router.get('/kyc/:requestId/face-scan', adminAuth, serveFaceScan);
router.get('/kyc/rules', adminAuth, getKycRules);
router.put('/kyc/rules', adminAuth, updateKycRules);

// Settings
router.get('/settings', adminAuth, getSettings);
router.post('/settings', adminAuth, updateSettings);
router.put('/boost-settings', adminAuth, updateBoostSettings);
router.get('/referral-settings', adminAuth, ReferralController.getAdminSettings);
router.put('/referral-settings', adminAuth, ReferralController.updateAdminSettings);

// Stats
router.get('/stats', adminAuth, getDashboardStats);
router.get('/swaps', adminAuth, getSwapHistory);

// Notifications
router.post('/notifications/broadcast', adminAuth, sendBroadcast);
router.post('/notifications/test-push', adminAuth, testPush);
router.post('/notifications/trigger-mining-reminders', adminAuth, triggerMiningReminders);

// App Versions
router.get('/app-versions', adminAuth, listVersions);
router.post('/app-versions', adminAuth, addVersion);
router.put('/app-versions/:id', adminAuth, updateVersion);
router.delete('/app-versions/:id', adminAuth, deleteVersion);

console.log('--- ADMIN ROUTES REGISTERED ---');
router.stack.forEach((r: any) => {
    if (r.route && r.route.path) {
        console.log(r.route.path);
    }
});

export default router;
