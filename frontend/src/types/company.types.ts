import { User } from './user.types';
import { Vehicle } from "@/types/vehicle.types";

export interface Company {
  _id: string;
  name: string;
  members: User[];
  owner: User;
  vehicles: Vehicle[];
}
