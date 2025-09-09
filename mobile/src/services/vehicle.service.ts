import api from '../config/api';
import { Vehicle } from '../types/vehicle.types';

export const getAssignedVehicle = async (): Promise<Vehicle | null> => {
  try {
    const { data } = await api.get<Vehicle>('/vehicles/assigned');
    return data;
  } catch (error) {
    console.error('Failed to fetch assigned vehicle', error);
    return null;
  }
};
