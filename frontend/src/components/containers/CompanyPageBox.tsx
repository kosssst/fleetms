"use client";

import classes from './CompanyPageBox.module.scss';
import { Paper } from '@mantine/core';
import { useCompany } from '@/hooks/useCompany';
import { Company } from '@/types/company.types';
import { Loading } from "@/components/common/Loading";
import { CompanyDetailsModule } from './CompanyDetails.module';
import { JoinCompanyForm } from '../forms/JoinCompanyForm';
import {useRouter} from "next/navigation";

export function CompanyPageBox() {
  const { company, loading, error, setCompany } = useCompany();
  const router = useRouter();

  const handleCompanyJoined = (newCompany: Company) => {
    setCompany(newCompany);
    router.push('/company');
  };

  if (loading) {
    return (
      <Paper radius="md" p="sm" withBorder className={classes.companyInfoBox}>
        <Loading />
      </Paper>
    );
  }

  if (company) {
    return <CompanyDetailsModule company={company} />;
  }

  if (error) {
    return <JoinCompanyForm onCompanyJoined={handleCompanyJoined} />;
  }

  return null;
}
