import mongoose, { Schema } from 'mongoose';
import { Company } from '../types/company.types';

const companySchema: Schema = new Schema({
  name: {
    type: String,
    required: [true, 'Name is required']
  }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      const retAny = ret as any;
      retAny.id = retAny._id;
      delete retAny._id;
      delete retAny.__v;
    }
  }
});

export const CompanyModel = mongoose.model<Company>('Company', companySchema);