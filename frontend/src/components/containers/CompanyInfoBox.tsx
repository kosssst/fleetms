"use client";

import classes from './CompanyInfoBox.module.scss';
import { Button, Paper, Text } from '@mantine/core';
import { useState } from "react";
import { CreateCompanyForm } from "@/components/forms/CreateCompanyForm";
import { useCompany } from '@/hooks/useCompany';
import { Company } from '@/types/company.types';
import { Loading } from "@/components/common/Loading";
import { CompanyDetailsModule } from './CompanyDetails.module';

export function CompanyInfoBox() {
  const { company, loading, error, setCompany } = useCompany();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const handleCompanyCreated = (newCompany: Company) => {
    setCompany(newCompany);
    setShowCreateForm(false);
  };

  if (loading) {
    return (
      <Paper radius="md" p="sm" withBorder className={classes.companyInfoBox}>
        <Loading />
      </Paper>
    );
  }

  if (showCreateForm) {
    return (
        <Paper radius="md" p="sm" withBorder className={classes.companyInfoBox}>
            <CreateCompanyForm onCompanyCreated={handleCompanyCreated} />
        </Paper>
    )
  }

  if (company) {
    return <CompanyDetailsModule company={company} />;
  }

  if (error) {
    return (
      <Paper radius="md" p="sm" withBorder className={classes.companyInfoBox}>
        <Text size="sm" fw={500}>
          You are not in a company yet.
          <br />
          Either create a new company or wait for an invitation.
        </Text>
        <Button onClick={() => setShowCreateForm(true)}>Create</Button>
      </Paper>
    );
  }

  return null;
}
