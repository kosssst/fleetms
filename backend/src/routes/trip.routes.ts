import express from 'express';
import { getTrips, getTripById, getSamplesForTrip } from '../controllers/trip.controller';
import { protect } from '../middleware/auth.middleware';

const router = express.Router();

router.route('/').get(protect, getTrips);
router.route('/:id').get(protect, getTripById);
router.route('/:id/samples').get(protect, getSamplesForTrip);

export default router;
