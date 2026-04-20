import {Router} from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {getUserData, getUserInfo, syncTimeVaryingData, getTimevaryingData} from '../controllers/kubios-controller.js';

const router = Router();

router.get('/user-data', authMiddleware, getUserData);
router.get('/user-info', authMiddleware, getUserInfo);
router.post('/sync-timevarying', authMiddleware, syncTimeVaryingData);
router.get('/timevarying', authMiddleware, getTimevaryingData);

export default router;
