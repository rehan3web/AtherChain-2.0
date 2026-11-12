import { Router } from 'express';
import { sendATH, getWalletStats, lookupAddress } from '../controllers/wallet';
import { auth } from '../middlewares/auth';

const router = Router();

// Internal account ledger.
router.get('/stats', auth, getWalletStats);
router.post('/send', auth, sendATH);
router.post('/lookup', auth, lookupAddress);

export default router;
