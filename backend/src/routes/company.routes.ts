import { Router } from 'express';
import { createCompany, getCompany, getCompanyUsers, joinCompany } from '../controllers/company.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/create', protect, createCompany);
router.post('/join', protect, joinCompany);
router.get('/', protect, getCompany);
router.get('/:companyId/users', protect, getCompanyUsers);

export default router;