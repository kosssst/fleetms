import api from '../lib/axios';
import {UpdateUserData, UpdatePassword, User} from '@/types/user.types';

export const updateUserData = async (userData: UpdateUserData) => {
  const { data } = await api.put('/users/me', userData);
  return data;
};

export const updatePassword = async (passwordData: UpdatePassword) => {
  const { data } = await api.put('/users/me/password', passwordData);
  return data;
};

export const getUsersByCompanyId = async (companyId: string): Promise<User[]> => {
    const { data } = await api.get(`/company/${companyId}/users`);
    return data;
}

export const updateUserRole = async (userId: string, role: string) => {
  const { data } = await api.put(`/users/${userId}/role`, { role });
  return data;
};
