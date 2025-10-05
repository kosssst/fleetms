"use client";

import { Button, Paper, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { companyService } from '@/services/company.service';
import { Company } from '@/types/company.types';
import Link from 'next/link';

interface JoinCompanyFormProps {
  onCompanyJoined: (company: Company) => void;
}

export const JoinCompanyForm = ({ onCompanyJoined }: JoinCompanyFormProps) => {
  const [invitationCode, setInvitationCode] = useState('');
  const [error, setError] = useState('');

  const handleJoinCompany = async () => {
    try {
      const company = await companyService.joinCompany(invitationCode);
      onCompanyJoined(company);
    } catch (error: unknown) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An unexpected error occurred');
      }
    }
  };

  return (
    <Paper radius="md" p="sm" withBorder>
      <Text size="sm" fw={500}>
        Enter an invitation code to join a company.
      </Text>
      <TextInput
        label="Invitation Code"
        value={invitationCode}
        onChange={(event) => setInvitationCode(event.currentTarget.value)}
        error={error}
      />
      <Button onClick={handleJoinCompany} mt="sm">
        Join
      </Button>
      <Text size="xs" mt="sm">
        No invitation code? <Link href="/company/create">Create a new company</Link>
      </Text>
    </Paper>
  );
};