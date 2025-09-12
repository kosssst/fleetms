
export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  token: string;
  companyId?: string;
}

export type UserRole = 'user' | 'company_owner' | 'admin' | 'logist' | 'driver';
