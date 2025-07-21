import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { CompanyModel } from '../models/company.model';
import { UserModel } from '../models/user.model';
import { User } from '../types/user.types';

interface RequestWithUser extends Request {
  user?: User;
}

export const createCompany = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { name } = req.body;
  const user = req.user;

  if (!user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const company = await CompanyModel.create({ name });

  await UserModel.findByIdAndUpdate(user._id, {
    companyId: company._id,
    role: 'company_owner',
  });

  res.status(201).json(company.toObject());
});

export const getCompany = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(404);
    throw new Error('User is not associated with a company');
  }

  const company = await CompanyModel.findById(user.companyId);

  if (company) {
    res.json(company.toObject());
  } else {
    res.status(404);
    throw new Error('Company not found');
  }
});