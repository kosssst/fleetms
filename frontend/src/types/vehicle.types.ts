
import { User } from './user.types';

export interface Vehicle {
  id: string;
  manufacturer: string;
  modelName: string;
  number: string;
  numberOfCylinders: number;
  companyId: string;
  driverId?: string | User;
  createdAt: string;
  updatedAt: string;
}
