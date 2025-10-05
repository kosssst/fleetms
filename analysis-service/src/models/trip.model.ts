import { Schema, model, Document, Types } from 'mongoose';

export interface ITrip extends Document {
  driverId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  companyId: Types.ObjectId;
  status: 'ongoing' | 'paused' | 'completed';
  startTime: Date;
  endTime?: Date;
  ingestCounters?: {
    samplesReceived: number;
    duplicatesDeduped: number;
    acksSent: number;
  };
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
  };
}

const TripSchema = new Schema<ITrip>({
  driverId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  status: { type: String, enum: ['ongoing', 'paused', 'completed'], required: true },
  startTime: { type: Date, required: true },
  endTime: { type: Date },
  ingestCounters: {
    samplesReceived: { type: Number },
    duplicatesDeduped: { type: Number },
    acksSent: { type: Number },
  },
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
  },
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