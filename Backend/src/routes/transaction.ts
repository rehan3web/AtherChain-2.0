import { Router } from 'express';
import { getTransactions } from '../controllers/transaction';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/', auth, getTransactions);

export default router;
