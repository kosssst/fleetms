import axiosInstance from '@/lib/axios';
import { Summary } from '@/types/dashboard.types';

export const getSummary = async (from: string, to: string): Promise<Summary> => {
  const response = await axiosInstance.get('/dashboard/summary', {
    params: { from, to }
  });
  return response.data;
}