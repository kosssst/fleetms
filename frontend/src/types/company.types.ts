import { User } from './user.types';

export interface Company {
  _id: string;
  name: string;
  members: User[];
}
