import { Router } from 'express';
import { auth as authenticateToken } from '../middlewares/auth';
import { getNotifications, markAsRead } from '../controllers/userNotification';

const router = Router();

router.get('/', authenticateToken, getNotifications);
router.post('/:id/read', authenticateToken, markAsRead);

export default router;
