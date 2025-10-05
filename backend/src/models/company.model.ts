import { Schema, model, Document, Types } from 'mongoose';
import crypto from 'crypto';

export interface ICompany extends Document {
  name: string;
  address: string;
  phone: string;
  members: Types.ObjectId[];
  vehicles: Types.ObjectId[];
  owner: Types.ObjectId;
  invitationCode: string;
}

const CompanySchema = new Schema<ICompany>({
  name: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  vehicles: [{ type: Schema.Types.ObjectId, ref: 'Vehicle' }],
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  invitationCode: { type: String, required: true, default: () => crypto.randomBytes(4).toString('hex'), unique: true }
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

export const CompanyModel = model<ICompany>('Company', CompanySchema);
