export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'user' | 'company_owner' | 'admin';
  token: string;
  companyId?: string;
}

export interface UpdateUserData {
  firstName: string;
  lastName: string;
  email: string;
}

export interface UpdatePassword {
  currentPassword: string;
  newPassword: string;
}
