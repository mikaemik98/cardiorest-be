import {Router} from 'express';
import {postRegister, postLogin} from '../controllers/authController.js';
import {postLogin as kubiosPostLogin, getMe} from '../controllers/kubios-auth-controller.js';

const router = Router();

router.post('/register', postRegister);
router.post('/login', kubiosPostLogin);           // tavallinen login
router.post('/kubios-login', kubiosPostLogin); // kubios login

export default router;