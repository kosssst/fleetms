
import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { VehicleModel } from '../models/vehicle.model';
import { UserModel } from '../models/user.model';
import { User } from '../types/user.types';

interface RequestWithUser extends Request {
  user?: User;
}

export const createVehicle = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { manufacturer, modelName, number, engineVolume } = req.body;
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  if (user.role !== 'company_owner' && user.role !== 'logist') {
    res.status(403);
    throw new Error('Forbidden');
  }

  const vehicle = await VehicleModel.create({
    manufacturer,
    modelName,
    number,
    engineVolume,
    companyId: user.companyId
  });

  res.status(201).json(vehicle.toObject());
});

export const getVehicles = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const vehicles = await VehicleModel.find({ companyId: user.companyId }).populate('driverId', 'firstName lastName');
  res.json(vehicles);
});

export const updateVehicle = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const { manufacturer, modelName, number, engineVolume } = req.body;
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  if (user.role !== 'company_owner' && user.role !== 'logist') {
    res.status(403);
    throw new Error('Forbidden');
  }

  const vehicle = await VehicleModel.findOneAndUpdate({ _id: id, companyId: user.companyId }, {
    manufacturer,
    modelName,
    number,
    engineVolume
  }, { new: true });

  if (!vehicle) {
    res.status(404);
    throw new Error('Vehicle not found');
  }

  res.json(vehicle.toObject());
});

export const deleteVehicle = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { id } = req.params;
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  if (user.role !== 'company_owner' && user.role !== 'logist') {
    res.status(403);
    throw new Error('Forbidden');
  }

  const vehicle = await VehicleModel.findOneAndDelete({ _id: id, companyId: user.companyId });

  if (!vehicle) {
    res.status(404);
    throw new Error('Vehicle not found');
  }

  res.status(204).send();
});

export const assignVehicle = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { vehicleId, driverId } = req.body;
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  if (user.role !== 'company_owner' && user.role !== 'logist') {
    res.status(403);
    throw new Error('Forbidden');
  }

  const vehicle = await VehicleModel.findOne({ _id: vehicleId, companyId: user.companyId });
  if (!vehicle) {
    res.status(404);
    throw new Error('Vehicle not found');
  }

  const driver = await UserModel.findOne({ _id: driverId, companyId: user.companyId });
  if (!driver) {
    res.status(404);
    throw new Error('Driver not found');
  }

  // Unassign the vehicle from the previous driver if any
  if (vehicle.driverId) {
    await UserModel.findByIdAndUpdate(vehicle.driverId, { $unset: { vehicleId: 1 } });
  }

  // Assign the vehicle to the new driver
  vehicle.driverId = driver._id;
  await vehicle.save();

  // Update the driver's role to 'driver'
  driver.role = 'driver';
  await driver.save();

  res.json(vehicle.toObject());
});
