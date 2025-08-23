import api from '../lib/axios';
import { User } from '@/types/user.types';

export const getCompany = async () => {
  const { data } = await api.get('/company');
  return data;
};

export const createCompany = async (name: string) => {
  const { data } = await api.post('/company/create', { name });
  return data;
};

export const getCompanyUsers = async (companyId: string) => {
  const { data } = await api.get<User[]>(`/company/${companyId}/users`);
  return data;
};
