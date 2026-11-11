
import { Router } from 'express';
import { createNews, listNews, updateNews, deleteNews, newsUpload } from '../controllers/news';
import { adminAuth } from '../middlewares/admin'; // Assuming adminAuth exists
import { auth } from '../middlewares/auth'; // Optional if we want authenticated users only to read news

const router = Router();

// Public / User Routes
router.get('/', listNews); // Publicly accessible or use auth middleware if needed

// Admin Routes
router.post('/admin', adminAuth, newsUpload.single('image'), createNews);
router.put('/admin/:id', adminAuth, newsUpload.single('image'), updateNews);
router.delete('/admin/:id', adminAuth, deleteNews);

export default router;
