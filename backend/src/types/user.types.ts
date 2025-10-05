import mongoose, { Types } from 'mongoose';

export interface User extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: 'user' | 'company_owner' | 'admin' | 'logist' | 'driver';
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  refreshToken?: string;
  companyId?: Types.ObjectId;
  vehicleId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  matchPassword: (enteredPassword: string) => Promise<boolean>;
  getResetPasswordToken: () => string;
}
