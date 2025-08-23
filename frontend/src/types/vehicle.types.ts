
import { User } from './user.types';

export interface Vehicle {
  id: string;
  manufacturer: string;
  model: string;
  number: string;
  engineVolume: number;
  companyId: string;
  driverId?: string | User;
  createdAt: string;
  updatedAt: string;
}
