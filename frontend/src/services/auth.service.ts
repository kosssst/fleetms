import api from '../lib/axios';
import { LoginFormValues, RegisterFormValues } from '@/types/auth.types';

export const login = async (credentials: LoginFormValues) => {
  const { data } = await api.post('/auth/login', credentials);
  return data;
};

export const register = async (userData: RegisterFormValues) => {
  const { data } = await api.post('/auth/register', userData);
  return data;
};

export const getProfile = async () => {
  const { data } = await api.get('/auth/profile');
  return data;
};

export const checkAuth = async () => {
    const { data } = await api.get('/auth/check');
    return data;
};

export const getMe = async () => {
    const { data } = await api.get('/auth/me');
    return data;
};
