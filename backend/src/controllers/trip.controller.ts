import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { TripModel } from '../models/trip.model';
import { SampleModel } from '../models/sample.model';
import { User } from '../types/user.types';

interface RequestWithUser extends Request {
  user?: User;
}

export const getTrips = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const trips = await TripModel.find({ companyId: user.companyId })
    .populate('driverId', 'firstName lastName')
    .populate('vehicleId', 'number');
  res.json(trips);
});

export const getTripById = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const trip = await TripModel.findOne({ _id: id, companyId: user.companyId });

  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  if (trip.status !== 'ended') {
    res.status(403);
    throw new Error('Trip not ended');
  }

  res.json(trip);
});

export const getSamplesForTrip = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const trip = await TripModel.findOne({ _id: id, companyId: user.companyId });

  if (!trip) {
    res.status(404);
    throw new Error('Trip not found');
  }

  const samples = await SampleModel.find({ tripId: id });
  res.json(samples);
});
