import mongoose from 'mongoose';

export interface Company extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  address: string;
  phone: string;
  members: mongoose.Types.ObjectId[];
  vehicles: mongoose.Types.ObjectId[];
  owner: mongoose.Types.ObjectId;
}
