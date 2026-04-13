import {Router} from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {getUserData, getUserInfo} from '../controllers/kubios-controller.js';

const router = Router();

router.get('/user-data', authMiddleware, getUserData);
router.get('/user-info', authMiddleware, getUserInfo);

export default router;
