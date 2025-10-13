'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useCompany } from '@/hooks/useCompany';
import { Loading } from '@/components/common/Loading';
import { JoinCompanyForm } from '@/components/forms/JoinCompanyForm';
import { Company } from '@/types/company.types';

const PUBLIC_SUBROUTES = ['/company/create']; // сюди пускаємо без компанії

export function CompanyGuard({ children }: { children: React.ReactNode }) {
  const { company, loading, error, setCompany } = useCompany();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_SUBROUTES.some((p) => pathname.startsWith(p));

  const handleJoined = (newCompany: Company) => {
    setCompany(newCompany);
    router.push('/company');
  };

  if (isPublic) return <>{children}</>;

  if (loading) return <Loading />;

  if (company) return <>{children}</>;

  if (error) return <JoinCompanyForm onCompanyJoined={handleJoined} />;

  return null;
}