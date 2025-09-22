import axiosInstance from '@/lib/axios';
import { Sample } from '@/types/sample.types';

export const getSamplesForTrip = async (tripId: string): Promise<Sample[]> => {
  const response = await axiosInstance.get(`/trips/${tripId}/samples`);
  return response.data;
};
