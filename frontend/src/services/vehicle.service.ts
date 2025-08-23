
import api from '@/lib/axios';
import { Vehicle } from '@/types/vehicle.types';

export const createVehicle = async (vehicleData: Omit<Vehicle, 'id' | 'companyId' | 'driverId' | 'createdAt' | 'updatedAt'>) => {
  const { data } = await api.post<Vehicle>('/vehicles', vehicleData);
  return data;
};

export const getVehicles = async () => {
  const { data } = await api.get<Vehicle[]>('/vehicles');
  return data;
};

export const updateVehicle = async (id: string, vehicleData: Partial<Vehicle>) => {
  const { data } = await api.put<Vehicle>(`/vehicles/${id}`, vehicleData);
  return data;
};

export const deleteVehicle = async (id: string) => {
  await api.delete(`/vehicles/${id}`);
};

export const assignVehicle = async (vehicleId: string, driverId: string) => {
  const { data } = await api.post<Vehicle>('/vehicles/assign', { vehicleId, driverId });
  return data;
};
