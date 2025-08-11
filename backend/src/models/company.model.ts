import { Schema, model, Document, Types } from 'mongoose';

interface ICompany extends Document {
  name: string;
  members: Types.ObjectId[];
}

const CompanySchema = new Schema<ICompany>({
  name: { type: String, required: true },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }]
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
