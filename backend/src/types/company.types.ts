import mongoose from 'mongoose';

export interface Company extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  name: string;
}
