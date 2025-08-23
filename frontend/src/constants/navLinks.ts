import { NavLink } from '@/types/common.types';

export const navLinks: NavLink[] = [
  { label: 'Company', href: '/company', authRequired: true },
  { label: 'Vehicles', href: '/vehicles', authRequired: true },
];
