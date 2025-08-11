import { Router } from 'express';
import { createCompany, getCompany, getCompanyUsers } from '../controllers/company.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/create', protect, createCompany);
router.get('/', protect, getCompany);
router.get('/:companyId/users', protect, getCompanyUsers);

export default router;