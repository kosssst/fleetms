import { Router } from 'express';
import { updateUserData, updatePassword, updateUserRole } from '../controllers/user.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.put('/me', protect, updateUserData);
router.put('/me/password', protect, updatePassword);
router.put('/:userId/role', protect, updateUserRole);

export default router;
