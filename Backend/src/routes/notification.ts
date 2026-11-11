import { Router } from 'express';
import { getVapidPublicKey, subscribeUser, toggleReminders, getNotificationPreferences } from '../controllers/notification';
import { auth } from '../middlewares/auth';

const router = Router();

router.get('/vapid-public-key', auth, getVapidPublicKey);
router.post('/subscribe', auth, subscribeUser);
router.post('/toggle-reminders', auth, toggleReminders);
router.get('/preferences', auth, getNotificationPreferences);

export default router;
