import {Divider, List, Paper, Text, Title} from "@mantine/core";
import {Company} from "@/types/company.types";
import { useAuth } from "@/context/AuthContext";

interface CompanyDetailsProps {
  company: Company;
}

export const CompanyInfoModule = ({ company }: CompanyDetailsProps) => {
  const { user } = useAuth();

  const canViewInvitationCode = user?.role === 'company_owner' || user?.role === 'logist';

  return (
    <div>
      <Title order={1}>{company.name}</Title>
      <Divider my="sm" />
      <List>
        <List.Item>Owner: {company.owner.firstName} {company.owner.lastName}</List.Item>
        <List.Item>Members: {company.members.length}</List.Item>
        <List.Item>Vehicles: {company.vehicles.length}</List.Item>
      </List>
      {canViewInvitationCode && company.invitationCode && (
        <Paper radius="md" p="sm" withBorder mt="md">
          <Text size="sm" fw={500}>
            Invitation Code
          </Text>
          <Text>{company.invitationCode}</Text>
        </Paper>
      )}
    </div>
  );
}