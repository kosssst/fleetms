import { Paper, Tabs } from "@mantine/core";
import { Company } from "@/types/company.types";
import { UsersTable } from "@/components/tables/UsersTable";
import { VehiclesTable } from "@/components/tables/VehiclesTable";
import {IconUsers, IconTruck, IconInfoCircle} from "@tabler/icons-react";
import {CompanyInfoModule} from "@/components/containers/CompanyInfo.module";
import classes from "../../styles/CompanyDetails.module.scss"

interface CompanyDetailsProps {
  company: Company;
}

export const CompanyDetailsModule = ({ company }: CompanyDetailsProps) => {
  return (
    <Tabs defaultValue="companyInfo">
      <Tabs.List>
        <Tabs.Tab value="companyInfo" leftSection={<IconInfoCircle size={16} />}>
          Company Info
        </Tabs.Tab>
        <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
          Users
        </Tabs.Tab>
        <Tabs.Tab value="vehicles" leftSection={<IconTruck size={16} />}>
          Vehicles
        </Tabs.Tab>
      </Tabs.List>
      <Paper radius="md" p="sm" withBorder className={classes.paper}>
        <Tabs.Panel value="companyInfo" pt="xs">
          <CompanyInfoModule company={company} />
        </Tabs.Panel>

        <Tabs.Panel value="users" pt="xs">
          <UsersTable companyId={company._id} />
        </Tabs.Panel>

        <Tabs.Panel value="vehicles" pt="xs">
          <VehiclesTable />
        </Tabs.Panel>
      </Paper>
    </Tabs>
  );
};
