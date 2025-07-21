import { User } from './user.types';

declare global {
  namespace Express {
    export interface Request {
      user?: User;
    }
  }
}

export {};