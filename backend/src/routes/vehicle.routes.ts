
import { Router } from 'express';
import {
  createVehicle,
  getVehicles,
  updateVehicle,
  deleteVehicle,
  assignVehicle,
  getAssignedVehicle
} from '../controllers/vehicle.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/', protect, createVehicle);
router.get('/', protect, getVehicles);
router.put('/:id', protect, updateVehicle);
router.delete('/:id', protect, deleteVehicle);
router.post('/assign', protect, assignVehicle);
router.get('/assigned', protect, getAssignedVehicle);

export default router;
