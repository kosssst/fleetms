
import { Schema, model, Document, Types } from 'mongoose';

export interface IVehicle extends Document {
  manufacturer: string;
  modelName: string;
  number: string;
  numberOfCylinders: number;
  companyId: Types.ObjectId;
  driverId?: Types.ObjectId;
}

const VehicleSchema = new Schema<IVehicle>({
  manufacturer: { type: String, required: true },
  modelName: { type: String, required: true },
  number: { type: String, required: true, unique: true },
  numberOfCylinders: { type: Number, required: true },
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'User' }
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

export const VehicleModel = model<IVehicle>('Vehicle', VehicleSchema);
