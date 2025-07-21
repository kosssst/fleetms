import { Router } from 'express';
import { createCompany, getCompany } from '../controllers/company.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/create', protect, createCompany);
router.get('/', protect, getCompany);

export default router;