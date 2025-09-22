import { Schema, model, Document, Types } from 'mongoose';

export interface ISample extends Document {
  tripId: Types.ObjectId;
  timestamp: Date;
  gps: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  obd: {
    vehicleSpeed: number;
    engineRpm: number;
    acceleratorPosition: number;
    engineCoolantTemp: number;
    intakeAirTemp: number;
    fuelConsumptionRate: number;
  };
}

const SampleSchema = new Schema<ISample>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  timestamp: { type: Date, required: true },
  gps: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    altitude: { type: Number, required: true },
  },
  obd: {
    vehicleSpeed: { type: Number, required: true },
    engineRpm: { type: Number, required: true },
    acceleratorPosition: { type: Number, required: true },
    engineCoolantTemp: { type: Number, required: true },
    intakeAirTemp: { type: Number, required: true },
    fuelConsumptionRate: { type: Number, required: true },
  },
}, {
  timestamps: true,
  toJSON: {
    transform(doc, ret) {
      const { _id, __v, ...obj } = ret;
      obj.id = _id;
      return obj;
    }
  }
});

export const SampleModel = model<ISample>('Sample', SampleSchema);
