import {Request} from "express";
import {User} from "../types/user.types";
import {TripModel} from "../models/trip.model";
import dayjs from "dayjs";
import {Types} from "mongoose";
import {VehicleModel} from "../models/vehicle.model";

interface RequestWithUser extends Request {
  user?: User;
}

export const getSummary = async (req: RequestWithUser, res: any) => {
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const { from, to } = req.query as { from?: string; to?: string };

  if (!from || !to) {
    return res.status(400).json({ message: "Query params 'from' and 'to' are required" });
  }

  const fromDate = dayjs(from, "DD-MM-YYYY", true).startOf("day");
  const toDate   = dayjs(to,   "DD-MM-YYYY", true).endOf("day");

  if (!fromDate.isValid() || !toDate.isValid()) {
    return res.status(400).json({ message: "Invalid date format, expected DD-MM-YYYY" });
  }

  const query: any = {
    status: "completed",
    endTime: { $gte: fromDate.toDate(), $lte: toDate.toDate() },
    companyId: new Types.ObjectId(user.companyId),
  };

  const trips = await TripModel.find(query);
  const vehicles = await VehicleModel.find();

  const idToVehicleNumber = new Map<string, string>(
    vehicles.map(v => [String(v._id), v.number])
  );

  let summary: any = {
    distanceKm: {
      total: 0,
      top: [] as Array<{ vehicleNumber: string; distanceKm: number }>
    },
    fuelUsedL: {
      total: 0,
      top: [] as Array<{ vehicleNumber: string; fuelUsedL: number }>
    },
    fuelUsedInIdleL: 0,
    fuelUsedInMotionL: 0,
    idleDurationSec: 0,
    motionDurationSec: 0,
  }

  const byVehicle = new Map<string, { distanceKm: number; fuelUsedL: number }>();

  for (const trip of trips) {
    if (!trip.summary) continue;

    const d = trip.summary.distanceKm ?? 0;
    const f = trip.summary.fuelUsedL ?? 0;
    const fi = trip.summary.fuelUsedInIdleL ?? 0;
    const fm = trip.summary.fuelUsedInMotionL ?? 0;
    const idl = trip.summary.idleDurationSec ?? 0;
    const mot = trip.summary.motionDurationSec ?? 0;

    summary.distanceKm.total  += d;
    summary.fuelUsedL.total   += f;
    summary.fuelUsedInIdleL   += fi;
    summary.fuelUsedInMotionL += fm;
    summary.idleDurationSec   += idl;
    summary.motionDurationSec += mot;

    const key = String(trip.vehicleId ?? "");
    if (!key) continue;

    const cur = byVehicle.get(key) ?? { distanceKm: 0, fuelUsedL: 0 };
    cur.distanceKm += d;
    cur.fuelUsedL  += f;
    byVehicle.set(key, cur);
  }

  const distanceArr = Array.from(byVehicle.entries()).map(([vehicleId, agg]) => ({
    vehicleNumber: idToVehicleNumber.get(vehicleId) ?? "(unknown)",
    distanceKm: agg.distanceKm,
  }));

  const fuelArr = Array.from(byVehicle.entries()).map(([vehicleId, agg]) => ({
    vehicleNumber: idToVehicleNumber.get(vehicleId) ?? "(unknown)",
    fuelUsedL: agg.fuelUsedL,
  }));

  summary.distanceKm.top = distanceArr.sort((a, b) => b.distanceKm - a.distanceKm).slice(0, 3);
  summary.fuelUsedL.top  = fuelArr.sort((a, b) => b.fuelUsedL  - a.fuelUsedL ).slice(0, 3);

  res.status(200).json(summary);
}