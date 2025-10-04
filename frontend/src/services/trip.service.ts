import axiosInstance from '@/lib/axios';
import { Trip } from '@/types/trip.types';

export const getTrips = async (): Promise<Trip[]> => {
  const response = await axiosInstance.get('/trips');
  return response.data;
};

export const getTripById = async (id: string): Promise<Trip> => {
  const response = await axiosInstance.get(`/trips/${id}`);
  return response.data;
};

export const reanalyzeTrip = async (id: string): Promise<void> => {
  await axiosInstance.post(`/trips/${id}/reanalyze`);
};

export const deleteTrip = async (id: string): Promise<void> => {
  await axiosInstance.delete(`/trips/${id}`);
};
