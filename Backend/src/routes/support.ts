import { Router } from 'express';
import { createTicket, createAppeal, listTickets, getTicketDetails, replyTicket, supportUpload } from '../controllers/support';
import { auth } from '../middlewares/auth';
import { adminAuth } from '../middlewares/admin';

const router = Router();

// User Routes (Authenticated)
router.post('/', auth, supportUpload.single('image'), createTicket);
router.post('/appeal', supportUpload.single('image'), createAppeal); // Public appeal for blocked users
router.get('/', auth, listTickets);
router.get('/:id', auth, getTicketDetails);
router.post('/:id/reply', auth, supportUpload.single('image'), replyTicket);

// Admin Routes (Explicit admin paths if needed, though listTickets keying off role also works)
// Keeping specific admin routes for clarity or specific admin-only actions if any
router.get('/admin/list', adminAuth, listTickets); // Alias for listTickets with admin role
router.get('/admin/:id', adminAuth, getTicketDetails); // Alias
router.post('/admin/:id/reply', adminAuth, supportUpload.single('image'), replyTicket);

export default router;
