'use client';

import { Divider, List, Paper, Text, Title, Skeleton, CopyButton, Button } from '@mantine/core';
import { useAuth } from '@/context/AuthContext';
import { useCompany } from '@/hooks/useCompany';
import type { Company } from '@/types/company.types';

function canViewInvitationCode(role?: string) {
  return role === 'company_owner' || role === 'logist';
}

export function CompanyInfoModule() {
  const { user } = useAuth();
  const { company, loading, error } = useCompany();

  if (loading) {
    return (
      <div>
        <Skeleton height={28} width={240} mb="sm" />
        <Skeleton height={16} mt="sm" />
        <Skeleton height={16} mt="xs" />
        <Skeleton height={16} mt="xs" />
      </div>
    );
  }

  if (error || !company) return null;

  return <CompanyInfoView company={company} canSeeInvite={canViewInvitationCode(user?.role)} />;
}

function CompanyInfoView({ company, canSeeInvite }: { company: Company; canSeeInvite: boolean; }) {
  const ownerFirst = company.owner?.firstName ?? '';
  const ownerLast = company.owner?.lastName ?? '';

  const membersCount = company.members?.length ?? 0;
  const vehiclesCount = company.vehicles?.length ?? 0;

  return (
    <div>
      <Title order={1}>{company.name}</Title>
      <Divider my="sm" />
      <List>
        <List.Item>
          Owner: {ownerFirst} {ownerLast}
        </List.Item>
        <List.Item>Members: {membersCount}</List.Item>
        <List.Item>Vehicles: {vehiclesCount}</List.Item>
      </List>

      {canSeeInvite && company.invitationCode && (
        <Paper radius="md" p="sm" withBorder mt="md">
          <Text size="sm" fw={500}>
            Invitation Code
          </Text>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <Text>{company.invitationCode}</Text>
            <CopyButton value={company.invitationCode}>
              {({ copied, copy }) => (
                <Button variant="light" size="xs" onClick={copy}>
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              )}
            </CopyButton>
          </div>
        </Paper>
      )}
    </div>
  );
}