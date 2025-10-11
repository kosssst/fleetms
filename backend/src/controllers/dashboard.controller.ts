import {Request} from "express";
import {User} from "../types/user.types";
import {TripModel} from "../models/trip.model";
import dayjs from "dayjs";
import {Types} from "mongoose";

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

  const match: any = {
    status: "completed",
    endTime: { $gte: fromDate.toDate(), $lte: toDate.toDate() },
    companyId: new Types.ObjectId(user.companyId),
  };

  const [row] = await TripModel.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        distanceKm: { $sum: { $ifNull: ["$summary.distanceKm", 0] } },
        fuelUsedL:  { $sum: { $ifNull: ["$summary.fuelUsedL",  0] } },
      },
    },
    { $project: { _id: 0, distanceKm: 1, fuelUsedL: 1 } },
  ]);

  const summary = row ?? { distanceKm: 0, fuelUsedL: 0 };
  res.status(200).json(summary);
}