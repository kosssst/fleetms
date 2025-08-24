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

export const getCompanyUsers = async (companyId: string) => {
  const { data } = await api.get<User[]>(`/company/${companyId}/users`);
  return data;
};
