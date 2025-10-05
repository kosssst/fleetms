
import { Types } from 'mongoose';

export interface Vehicle {
  _id: Types.ObjectId;
  manufacturer: string;
  modelName: string;
  number: string;
  numberOfCylinders: number;
  companyId: Types.ObjectId;
  driverId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
