// controllers/summary.controller.ts
import { Request } from "express";
import { Types } from "mongoose";
import { TripModel } from "../models/trip.model";
import { VehicleModel } from "../models/vehicle.model";
import dayjs from "../override/dayjs";
import { User } from "../types/user.types";

interface RequestWithUser extends Request {
  user?: User;
}

interface TopDist {
  vehicleNumber: string;
  distanceKm: number;
}

interface TopFuel {
  vehicleNumber: string;
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
    throw new Error("Not authorized");
  }

  const { from, to } = req.query as { from?: string; to?: string };

  if (!from || !to) {
    return res
      .status(400)
      .json({ message: "Query params 'from' and 'to' are required" });
  }

  const fromDate = dayjs(from, "DD-MM-YYYY", true).startOf("day");
  const toDate = dayjs(to, "DD-MM-YYYY", true).endOf("day");

  if (!fromDate.isValid() || !toDate.isValid()) {
    return res
      .status(400)
      .json({ message: "Invalid date format, expected DD-MM-YYYY" });
  }

  // Побудувати список ключів-днів для паливного графіка
  const dayKeys: string[] = [];
  for (
    let d = fromDate.clone();
    d.isBefore(toDate) || d.isSame(toDate, "day");
    d = d.add(1, "day")
  ) {
    dayKeys.push(d.format("DD-MM-YYYY"));
  }

  const dailyFuel = new Map<string, number>();
  for (const k of dayKeys) dailyFuel.set(k, 0);

  // Базовий запит по поїздках у періоді
  const query: any = {
    status: "completed",
    endTime: { $gte: fromDate.toDate(), $lte: toDate.toDate() },
    companyId: new Types.ObjectId(user.companyId),
  };

  const trips = await TripModel.find(query).lean();

  // Агрегатори за ПЕРІОД (саме їх використаємо для TOP)
  const distByVeh = new Map<string, number>();
  const fuelByVeh = new Map<string, number>();

  // Початковий summary
  const summary: {
    distanceKm: { total: number; top: TopDist[] };
    fuelUsedL: { total: number; top: TopFuel[] };
    fuelUsedInIdleL: number;
    fuelUsedInMotionL: number;
    idleDurationSec: number;
    motionDurationSec: number;
    topFuelPer100Km: TopFuelEfficiency[];
    fuelUsedPerDay: Array<{ date: string; fuelUsedL: number }>;
    needsInspection: string[];
  } = {
    distanceKm: { total: 0, top: [] },
    fuelUsedL: { total: 0, top: [] },
    fuelUsedInIdleL: 0,
    fuelUsedInMotionL: 0,
    idleDurationSec: 0,
    motionDurationSec: 0,
    topFuelPer100Km: [],
    fuelUsedPerDay: [],
    needsInspection: [],
  };

  // Пройтись по поїздках і зібрати тотали та денне паливо
  for (const trip of trips) {
    // без summary — пропускаємо
    // @ts-ignore (тип у моделі)
    if (!trip.summary || !trip.endTime) continue;

    // @ts-ignore
    const d = Number(trip.summary.distanceKm ?? 0);
    // @ts-ignore
    const f = Number(trip.summary.fuelUsedL ?? 0);
    // @ts-ignore
    const fi = Number(trip.summary.fuelUsedInIdleL ?? 0);
    // @ts-ignore
    const fm = Number(trip.summary.fuelUsedInMotionL ?? 0);
    // @ts-ignore
    const idl = Number(trip.summary.idleDurationSec ?? 0);
    // @ts-ignore
    const mot = Number(trip.summary.motionDurationSec ?? 0);

    summary.distanceKm.total += d;
    summary.fuelUsedL.total += f;
    summary.fuelUsedInIdleL += fi;
    summary.fuelUsedInMotionL += fm;
    summary.idleDurationSec += idl;
    summary.motionDurationSec += mot;

    // Агреґація за авто (за період)
    // @ts-ignore
    const vidRaw = trip.vehicleId;
    const vid = vidRaw ? String(vidRaw) : null;
    if (vid) {
      distByVeh.set(vid, (distByVeh.get(vid) ?? 0) + (Number.isFinite(d) ? d : 0));
      fuelByVeh.set(vid, (fuelByVeh.get(vid) ?? 0) + (Number.isFinite(f) ? f : 0));
    }

    // Паливо по днях
    const key = dayjs(trip.endTime).format("DD-MM-YYYY");
    if (dailyFuel.has(key)) {
      // Якщо загального немає — скласти idle+motion
      // @ts-ignore
      const fd =
        (trip.summary.fuelUsedL ?? undefined) != null
          ? Number(trip.summary.fuelUsedL)
          : Number(trip.summary.fuelUsedInIdleL ?? 0) +
          Number(trip.summary.fuelUsedInMotionL ?? 0);

      dailyFuel.set(key, (dailyFuel.get(key) ?? 0) + (Number.isFinite(fd) ? fd : 0));
    }
  }

  // Підтягнути дані авто лише для тих, що зустрілись у періоді
  const vehicleIds = Array.from(new Set([...distByVeh.keys(), ...fuelByVeh.keys()]));
  let idToNumber = new Map<string, string>();
  if (vehicleIds.length > 0) {
    const vehicles = await VehicleModel.find({
      _id: { $in: vehicleIds.map((id) => new Types.ObjectId(id)) },
      companyId: new Types.ObjectId(user.companyId),
    })
      .select({ _id: 1, number: 1 })
      .lean();

    idToNumber = new Map(vehicles.map((v) => [String(v._id), v.number]));
  }

  // TOP distance за період
  summary.distanceKm.top = [...distByVeh.entries()]
    .map(([vid, dist]) => ({
      vehicleNumber: idToNumber.get(vid) ?? vid,
      distanceKm: Number((dist ?? 0).toFixed(2)),
    }))
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, 3);

  // TOP fuel за період
  summary.fuelUsedL.top = [...fuelByVeh.entries()]
    .map(([vid, fuel]) => ({
      vehicleNumber: idToNumber.get(vid) ?? vid,
      fuelUsedL: Number((fuel ?? 0).toFixed(2)),
    }))
    .sort((a, b) => b.fuelUsedL - a.fuelUsedL)
    .slice(0, 3);

  // TOP L/100km за період (акуратно із 0 км)
  summary.topFuelPer100Km = [...distByVeh.entries()]
    .map(([vid, dist]) => {
      const fuel = fuelByVeh.get(vid) ?? 0;
      const val = dist > 0 ? (fuel / dist) * 100 : 0;
      return {
        vehicleNumber: idToNumber.get(vid) ?? vid,
        fuelPer100Km: Number(val.toFixed(3)),
      };
    })
    .sort((a, b) => b.fuelPer100Km - a.fuelPer100Km)
    .slice(0, 3);

  // Денне паливо (рядок для графіка)
  summary.fuelUsedPerDay = dayKeys.map((date) => ({
    date,
    fuelUsedL: Math.round(((dailyFuel.get(date) ?? 0) + Number.EPSILON) * 100) / 100,
  }));

  // ---- ДОДАНО: перелік авто, що потребують огляду ----
  // Беремо всі авто компанії з needsInspection=true і кладемо їхні number
  const flagged = await VehicleModel.find({
    companyId: new Types.ObjectId(user.companyId),
    needsInspection: true,
  })
    .select({ number: 1 })
    .lean();

  summary.needsInspection = flagged.map((v) => v.number).filter(Boolean);

  // Округлити тотали красиво
  summary.distanceKm.total =
    Math.round((summary.distanceKm.total + Number.EPSILON) * 100) / 100;
  summary.fuelUsedL.total =
    Math.round((summary.fuelUsedL.total + Number.EPSILON) * 100) / 100;
  summary.fuelUsedInIdleL =
    Math.round((summary.fuelUsedInIdleL + Number.EPSILON) * 100) / 100;
  summary.fuelUsedInMotionL =
    Math.round((summary.fuelUsedInMotionL + Number.EPSILON) * 100) / 100;

  return res.status(200).json(summary);
};
