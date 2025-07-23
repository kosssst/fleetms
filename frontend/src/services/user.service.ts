import api from '../lib/axios';
import { UpdateUserData, UpdatePassword } from '@/types/user.types';

export const updateUserData = async (userData: UpdateUserData) => {
  const { data } = await api.put('/users/me', userData);
  return data;
};

export const updatePassword = async (passwordData: UpdatePassword) => {
  const { data } = await api.put('/users/me/password', passwordData);
  return data;
};
