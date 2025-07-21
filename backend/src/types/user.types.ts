import mongoose from 'mongoose';

export interface User extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: 'user' | 'company_owner' | 'admin';
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  refreshToken?: string;
  companyId?: mongoose.Types.ObjectId;
  matchPassword: (password: string) => Promise<boolean>;
  getResetPasswordToken: () => string;
}
