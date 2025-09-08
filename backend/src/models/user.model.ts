import mongoose, { Schema } from 'mongoose';
import crypto from 'crypto';
import { User } from '../types/user.types';

const userSchema: Schema = new Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'company_owner', 'admin', 'logist', 'driver'],
    default: 'user'
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  refreshToken: String,
  companyId: { type: Schema.Types.ObjectId, ref: 'Company' },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      const retAny = ret as any;
      delete retAny.__v;
      delete retAny.password; // Ensure password hash is never sent
    }
  }
});

userSchema.pre<User>('save', async function (next) {
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  const salt = crypto.randomBytes(16).toString('hex');
  this.password = crypto.pbkdf2Sync(this.password, salt, 1000, 64, 'sha512').toString('hex') + '.' + salt;
  next();
});

userSchema.methods.matchPassword = function (enteredPassword: string): boolean {
  if (!this.password) return false;
  const [hashedPassword, salt] = this.password.split('.');
  const hash = crypto.pbkdf2Sync(enteredPassword, salt, 1000, 64, 'sha512').toString('hex');
  return hashedPassword === hash;
};

userSchema.methods.getResetPasswordToken = function (): string {
  const resetToken = crypto.randomBytes(20).toString('hex');
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
  return resetToken;
};

export const UserModel = mongoose.model<User>('User', userSchema);
