import { Schema, model, Document, Types } from 'mongoose';

export interface IModel extends Document {
  _id: Types.ObjectId;
  vehicleId: Types.ObjectId;
  version: string;
  trainTripsIds: Types.ObjectId[];
  valTripsIds: Types.ObjectId[];
  trainSamples: number;
  valSamples: number;
  status: 'training' | 'completed' | 'failed' | 'pending';
  metrics?: {
    MAE: number;
    RMSE: number;
    R2: number;
  };
}

const ModelSchema = new Schema<IModel>({
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  version: { type: String, required: true },
  trainTripsIds: [{ type: Schema.Types.ObjectId, ref: 'Trip', required: true }],
  valTripsIds: [{ type: Schema.Types.ObjectId, ref: 'Trip', required: true }],
  trainSamples: { type: Number, required: true },
  valSamples: { type: Number, required: true },
  status: { type: String, enum: ['training', 'completed', 'failed', 'pending'], required: true },
  metrics: {
    MAE: { type: Number },
    RMSE: { type: Number },
    R2: { type: Number },
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
})

export const ModelModel = model<IModel>('Model', ModelSchema);