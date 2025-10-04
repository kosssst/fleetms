import { Router } from 'express';
import { getTrips, getTripById, getSamplesForTrip, reanalyzeTrip, deleteTrip } from '../controllers/trip.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.route('/').get(protect, getTrips);
router.route('/:id').get(protect, getTripById).delete(protect, deleteTrip);
router.route('/:id/samples').get(protect, getSamplesForTrip);
router.route('/:id/reanalyze').post(protect, reanalyzeTrip);

export default router;
