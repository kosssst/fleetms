import {Request} from "express";
import {User} from "../types/user.types";
import {TripModel} from "../models/trip.model";
import dayjs from "../override/dayjs";
import {Types} from "mongoose";
import {VehicleModel} from "../models/vehicle.model";

interface RequestWithUser extends Request {
  user?: User;
}

interface TopSummary {
  distanceKm: number;
  fuelUsedL: number;
}

interface TopFuelEfficiency {
  vehicleNumber: string;
  fuelPer100Km: number;
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

  const dayKeys: string[] = [];
  for (let d = fromDate.clone(); d.isBefore(toDate) || d.isSame(toDate, "day"); d = d.add(1, "day")) {
    dayKeys.push(d.format("DD-MM-YYYY"));
  }

  const dailyFuel = new Map<string, number>();
  for (const key of dayKeys) dailyFuel.set(key, 0);

  const query: any = {
    status: "completed",
    endTime: { $gte: fromDate.toDate(), $lte: toDate.toDate() },
    companyId: new Types.ObjectId(user.companyId),
  };

  const trips = await TripModel.find(query);
  const vehicles = await VehicleModel.find();

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
    topFuelPer100Km: [] as Array<{ vehicleNumber: string; fuelPer100Km: number }>,
    fuelUsedPerDay: [] as Array<{ date: string; fuelUsedL: number }>,
  }

  for (const trip of trips) {
    if (!trip.summary || !trip.endTime) continue;

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

    const key = dayjs(trip.endTime).format("DD-MM-YYYY");
    if (!dailyFuel.has(key)) continue; // поза межами діапазону (на випадок країв)

    const fd =
      (trip.summary.fuelUsedL ?? undefined) != null
        ? (trip.summary.fuelUsedL as number)
        : (trip.summary.fuelUsedInIdleL ?? 0) + (trip.summary.fuelUsedInMotionL ?? 0);

    dailyFuel.set(key, (dailyFuel.get(key) ?? 0) + (Number.isFinite(fd) ? fd : 0));
  }

  for (const vehicle of vehicles) {
    if (!vehicle.totalDistanceKm || !vehicle.totalFuelUsedL) continue;

    summary.distanceKm.top.push({
      vehicleNumber: vehicle.number,
      distanceKm: vehicle.totalDistanceKm,
    });

    summary.fuelUsedL.top.push({
      vehicleNumber: vehicle.number,
      fuelUsedL: vehicle.totalFuelUsedL,
    });

    summary.topFuelPer100Km.push({
      vehicleNumber: vehicle.number,
      fuelPer100Km: (vehicle.totalFuelUsedL / vehicle.totalDistanceKm) * 100,
    })
  }

  summary.distanceKm.top = summary.distanceKm.top.sort((a: TopSummary, b: TopSummary) => b.distanceKm - a.distanceKm).slice(0, 3);
  summary.fuelUsedL.top = summary.fuelUsedL.top.sort((a: TopSummary, b: TopSummary) => b.fuelUsedL - a.fuelUsedL).slice(0, 3);
  summary.topFuelPer100Km = summary.topFuelPer100Km.sort((a: TopFuelEfficiency, b: TopFuelEfficiency) => b.fuelPer100Km - a.fuelPer100Km).slice(0, 3);

  summary.fuelUsedPerDay = dayKeys.map((date) => ({
    date,
    fuelUsedL: Math.round(((dailyFuel.get(date) ?? 0) + Number.EPSILON) * 100) / 100,
  }));

  res.status(200).json(summary);
}