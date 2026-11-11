import { Router } from 'express';
import { ReferralController } from '../controllers/referral';
import { auth, adminAuth } from '../middlewares/auth';

const router = Router();

router.get('/stats', auth, ReferralController.getReferralStats);

// Admin Routes
router.get('/admin/settings', auth, adminAuth, ReferralController.getAdminSettings);
router.post('/admin/settings', auth, adminAuth, ReferralController.updateAdminSettings);

export default router;
