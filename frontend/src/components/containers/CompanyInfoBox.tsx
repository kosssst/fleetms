"use client";

import classes from './CompanyInfoBox.module.scss';
import { Button, Paper, Text, LoadingOverlay } from '@mantine/core';
import { useState } from "react";
import { CreateCompanyForm } from "@/components/forms/CreateCompanyForm";
import { useCompany } from '@/hooks/useCompany';
import { Company } from '@/types/company.types';

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
        <LoadingOverlay visible />
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
    return (
      <Paper radius="md" p="sm" withBorder className={classes.companyInfoBox}>
        <Text size="lg" fw={500}>{company.name}</Text>
        <Text size="xs" fw={500}>id: {company._id}</Text>
      </Paper>
    );
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
