import {Divider, List, Title} from "@mantine/core";
import {Company} from "@/types/company.types";

interface CompanyDetailsProps {
  company: Company;
}

export const CompanyInfoModule = ({ company }: CompanyDetailsProps) => {
  return (
    <div>
      <Title order={1}>{company.name}</Title>
      <Divider my="sm" />
      <List>
        <List.Item>Owner: {company.owner.firstName} {company.owner.lastName}</List.Item>
        <List.Item>Members: {company.members.length}</List.Item>
        <List.Item>Vehicles: {company.vehicles.length}</List.Item>
      </List>
    </div>
  );
}