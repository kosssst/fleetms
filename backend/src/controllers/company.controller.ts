import { Request, Response } from 'express';
import asyncHandler from 'express-async-handler';
import { CompanyModel } from '../models/company.model';
import { UserModel } from '../models/user.model';
import { User } from '../types/user.types';

interface RequestWithUser extends Request {
  user?: User;
}

export const createCompany = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { name, address, phone } = req.body;
  const user = req.user;

  if (!user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const company = await CompanyModel.create({
    name,
    address,
    phone,
    members: [user._id],
    owner: user._id
  });

  const updatedUser = await UserModel.findByIdAndUpdate(user._id, {
    companyId: company._id,
    role: 'company_owner',
  }, { new: true });

  res.status(201).json({ company: company.toObject(), user: updatedUser?.toObject() });
});

export const getCompany = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(404);
    throw new Error('User is not associated with a company');
  }

  const company = await CompanyModel.findById(user.companyId).populate('owner', 'firstName lastName');

  if (company) {
    const companyObject = company.toObject();
    if (user.role !== 'company_owner' && user.role !== 'logist') {
      const { invitationCode, ...rest } = companyObject;
      res.json(rest);
      return;
    }
    res.json(companyObject);
  } else {
    res.status(404);
    throw new Error('Company not found');
  }
});

export const getCompanyUsers = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const user = req.user;

  if (!user || !user.companyId) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Повертаємо учасників компанії користувача
  const company = await CompanyModel
    .findById(user.companyId)
    .populate('members') // можна обмежити поля через select
    .lean();

  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  res.json(company.members);
});

export const joinCompany = asyncHandler(async (req: RequestWithUser, res: Response) => {
  const { invitationCode } = req.body;
  const user = req.user;

  if (!user) {
    res.status(401);
    throw new Error('Not authorized');
  }

  if (user.companyId) {
    res.status(400);
    throw new Error('User is already in a company');
  }

  const company = await CompanyModel.findOne({ invitationCode });

  if (!company) {
    res.status(404);
    throw new Error('Company with this invitation code not found');
  }

  await CompanyModel.findByIdAndUpdate(company._id, {
    $addToSet: { members: user._id }
  });

  await UserModel.findByIdAndUpdate(user._id, {
    companyId: company._id,
  });

  res.status(200).json(company.toObject());
});
