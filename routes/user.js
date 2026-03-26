import {Router} from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {getProfile, updateProfile, deleteAccount} from '../controllers/userController.js';

const router = Router();

router.get('/profile', authMiddleware, getProfile);
router.patch('/profile', authMiddleware, updateProfile);
router.delete('/profile', authMiddleware, deleteAccount);

export default router;

