import api from '../lib/axios';
import { User } from '@/types/user.types';
import { Company } from '@/types/company.types';

export const getCompany = async () => {
  const { data } = await api.get('/company');
  return data;
};

export const createCompany = async (companyData: Pick<Company, 'name' | 'address' | 'phone'>) => {
  const { data } = await api.post('/company/create', companyData);
  return data;
};

export const getCompanyUsers = async (): Promise<User[]> => {
  const { data } = await api.get<User[]>('/company/users');
  return data;
};

export const joinCompany = async (invitationCode: string) => {
  const { data } = await api.post('/company/join', { invitationCode });
  return data;
};

export const companyService = {
  getCompany,
  createCompany,
  getCompanyUsers,
  joinCompany,
};
