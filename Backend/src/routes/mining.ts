import { Router } from 'express';
import { startMining, getMiningStatus, claimBoost, validateMining } from '../controllers/mining';
import { auth } from '../middlewares/auth';

const router = Router();

router.post('/start', auth, startMining);
router.post('/validate', auth, validateMining);
router.get('/status', auth, getMiningStatus);
router.post('/claim-boost', auth, claimBoost);

export default router;
