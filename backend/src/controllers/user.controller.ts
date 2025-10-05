import { Request, Response } from 'express';
import { UserModel } from '../models/user.model';
import asyncHandler from "express-async-handler";
import { User as IUser } from '../types/user.types';

interface RequestWithUser extends Request {
  user?: IUser;
}

export const updateUserData = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  try {
    const user = await UserModel.findByIdAndUpdate(req.user._id, req.body, { new: true });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updatePassword = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }
  const { currentPassword, newPassword } = req.body;

  try {
    const user = await UserModel.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateUserRole = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;
  const requester = req.user;

  if (!requester) {
    res.status(401);
    throw new Error('Not authorized');
  }

  if (requester.role !== 'company_owner' && requester.role !== 'logist') {
    res.status(403);
    throw new Error('Not authorized to change user roles');
  }

  if (requester._id.toString() === userId) {
    res.status(400);
    throw new Error('You cannot change your own role');
  }

  if (role === 'company_owner') {
    res.status(400);
    throw new Error('Cannot assign company_owner role');
  }

  const targetUser = await UserModel.findById(userId);

  if (!targetUser) {
    res.status(404);
    throw new Error('User not found');
  }

  if (requester.role === 'logist' && targetUser.role === 'company_owner') {
    res.status(403);
    throw new Error('Logists cannot change the role of a company owner');
  }

  targetUser.role = role;
  await targetUser.save();

  res.json(targetUser.toObject());
});
