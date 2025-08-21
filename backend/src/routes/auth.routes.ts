import { Router } from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  requestPasswordReset,
  resetPassword,
  checkAuth,
  getMe,
  mobileLogin,
} from '../controllers/auth.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/mobile-login', mobileLogin);
router.post('/refresh', refreshToken);
router.post('/request-password-reset', requestPasswordReset);
router.put('/reset-password/:resetToken', resetPassword);

router.post('/logout', protect, logout);
router.get('/check', protect, checkAuth);
router.get('/me', protect, getMe);

export default router;