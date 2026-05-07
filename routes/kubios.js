// Koodissa hyödynnetty tekoälyä Claude Sonnet v4.6 koodin rakentamiseen ja tarkistamiseen, sekä ymmärtämiseen

import {Router} from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import {getUserData, getUserInfo, syncTimeVaryingData, getTimevaryingData} from '../controllers/kubios-controller.js';

const router = Router();

router.get('/user-data', authMiddleware, getUserData);
router.get('/user-info', authMiddleware, getUserInfo);
router.post('/sync-timevarying', authMiddleware, syncTimeVaryingData);
router.get('/timevarying', authMiddleware, getTimevaryingData);

export default router;
