import {Router} from 'express';
import {postRegister} from '../controllers/authController.js';
import {postLogin, getMe} from '../controllers/kubios-auth-controller.js';
 
const router = Router();

router.post('/register', postRegister);
router.post('/login', postLogin);
 
export default router;