import { Router } from 'express';
import { getSwapRate, executeSwap, getSwapStatus } from '../controllers/swap';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/rate', auth, getSwapRate);
router.get('/status', auth, getSwapStatus);
router.post('/execute', auth, executeSwap);

export default router;
