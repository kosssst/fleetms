import { Paper, Title, Divider, Tabs } from "@mantine/core";
import { Company } from "@/types/company.types";
import { UsersTable } from "@/components/tables/UsersTable";
import { VehiclesTable } from "@/components/tables/VehiclesTable";
import { IconUsers, IconTruck } from "@tabler/icons-react";

interface CompanyDetailsProps {
  company: Company;
}

export const CompanyDetailsModule = ({ company }: CompanyDetailsProps) => {
  return (
    <Paper radius="md" p="sm" withBorder>
      <Title order={1}>{company.name}</Title>
      <Divider my="sm" />
      <Tabs defaultValue="users">
        <Tabs.List>
          <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
            Users
          </Tabs.Tab>
          <Tabs.Tab value="vehicles" leftSection={<IconTruck size={16} />}>
            Vehicles
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="users" pt="xs">
          <UsersTable companyId={company._id} />
        </Tabs.Panel>

        <Tabs.Panel value="vehicles" pt="xs">
          <VehiclesTable />
        </Tabs.Panel>
      </Tabs>
    </Paper>
  );
};