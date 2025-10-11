import { NavLink } from '@/types/common.types';

export const navLinks: NavLink[] = [
  { label: 'Dashboard', href: '/dashboard', authRequired: true },
  { label: 'Company', href: '/company', authRequired: true },
];
