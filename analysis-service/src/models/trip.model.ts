import { Schema, model, Document, Types } from 'mongoose';

export interface ITrip extends Document {
  driverId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  companyId: Types.ObjectId;
  status: 'ongoing' | 'paused' | 'completed';
  startTime: Date;
  endTime?: Date;
  gpsBbox?: {
    minLat: number;
    minLon: number;
    maxLat: number;
    maxLon: number;
  };
  summary?: {
    durationSec: number;
    distanceKm: number;
    avgSpeedKph: number;
    maxSpeedKph: number;
    avgRpm: number;
    maxRpm: number;
    fuelUsedL: number;
    avgFuelRateLph: number;
    route: {
      latitude: number;
      longitude: number;
    }[];
    fuelUsedInIdleL: number;
    fuelUsedInMotionL: number;
    idleDurationSec: number;
    motionDurationSec: number;
  };
  predictionSummary?: {
    fuelUsedL: number;
    avgFuelRateLph: number;
    MAE: number;
    RMSE: number;
    R2: number;
  };
  numSamples?: number;
  role?: string;
}

const TripSchema = new Schema<ITrip>({
  driverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  status: { type: String, enum: ['ongoing', 'paused', 'completed'], required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  gpsBbox: {
    minLat: { type: Number },
    minLon: { type: Number },
    maxLat: { type: Number },
    maxLon: { type: Number },
  },
  summary: {
    durationSec: { type: Number },
    distanceKm: { type: Number },
    avgSpeedKph: { type: Number },
    maxSpeedKph: { type: Number },
    avgRpm: { type: Number },
    maxRpm: { type: Number },
    fuelUsedL: { type: Number },
    avgFuelRateLph: { type: Number },
    route: [{
      latitude: { type: Number },
      longitude: { type: Number },
    }],
    fuelUsedInIdleL: { type: Number },
    fuelUsedInMotionL: { type: Number },
    idleDurationSec: { type: Number },
    motionDurationSec: { type: Number },
  },
  predictionSummary: {
    fuelUsedL: { type: Number },
    avgFuelRateLph: { type: Number },
    MAE: { type: Number },
    RMSE: { type: Number },
    R2: { type: Number },
  },
  numSamples: { type: Number },
  role: { type: String },
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      const { _id, __v, ...rest } = ret;
      return { id: _id, ...rest };
    }
  }
});

export const TripModel = model<ITrip>('Trip', TripSchema);