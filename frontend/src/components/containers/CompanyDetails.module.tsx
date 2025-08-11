"use client";

import {
  Paper,
  Text,
  Divider,
  Title,
  ScrollArea,
  Table,
  TextInput,
  UnstyledButton,
  Group,
  Center, keys
} from "@mantine/core";
import { useCompanyUsers } from "@/hooks/useCompanyUsers";
import { Company } from "@/types/company.types";
import { Loading } from "@/components/common/Loading";
import classes from "./CompanyDetails.module.scss"
import {useEffect, useState} from "react";
import {IconChevronDown, IconChevronUp, IconSearch, IconSelector} from "@tabler/icons-react";

interface CompanyDetailsProps {
  company: Company;
}

interface RowData {
  name: string;
  email: string;
  role: string;
}

interface ThProps {
  children: React.ReactNode;
  reversed: boolean;
  sorted: boolean;
  onSort: () => void;
}

function Th({ children, reversed, sorted, onSort }: ThProps) {
  const Icon = sorted ? (reversed ? IconChevronUp : IconChevronDown) : IconSelector;
  return (
    <Table.Th className={classes.th}>
      <UnstyledButton onClick={onSort} className={classes.control}>
        <Group justify="space-between">
          <Text fw={500} fz="sm">
            {children}
          </Text>
          <Center className={classes.icon}>
            <Icon size={16} stroke={1.5} />
          </Center>
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

function filterData(data: RowData[], search: string) {
  if (data.length === 0) {
    return [];
  }
  const query = search.toLowerCase().trim();
  return data.filter((item) =>
    keys(data[0]).some((key) => item[key].toLowerCase().includes(query))
  );
}

function sortData(
  data: RowData[],
  payload: { sortBy: keyof RowData | null; reversed: boolean; search: string }
) {
  const { sortBy } = payload;

  if (!sortBy) {
    return filterData(data, payload.search);
  }

  return filterData(
    [...data].sort((a, b) => {
      if (payload.reversed) {
        return b[sortBy].localeCompare(a[sortBy]);
      }

      return a[sortBy].localeCompare(b[sortBy]);
    }),
    payload.search
  );
}


export const CompanyDetailsModule = ({ company }: CompanyDetailsProps) => {
  const { users, loading: usersLoading, error: usersError } = useCompanyUsers(company._id);
  const [search, setSearch] = useState('');
  const [sortedData, setSortedData] = useState<RowData[]>([]);
  const [sortBy, setSortBy] = useState<keyof RowData | null>(null);
  const [reverseSortDirection, setReverseSortDirection] = useState(false);

  useEffect(() => {
    const initialData: RowData[] = users.map((user) => ({
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.role,
    }));
    setSortedData(initialData);
  }, [users]);

  const setSorting = (field: keyof RowData) => {
    const reversed = field === sortBy ? !reverseSortDirection : false;
    setReverseSortDirection(reversed);
    setSortBy(field);
    setSortedData(sortData(sortedData, { sortBy: field, reversed, search }));
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setSearch(value);
    setSortedData(sortData(sortedData, { sortBy, reversed: reverseSortDirection, search: value }));
  };

  const rows = sortedData.map((row) => (
    <Table.Tr key={row.name}>
      <Table.Td>{row.name}</Table.Td>
      <Table.Td>{row.email}</Table.Td>
      <Table.Td>{row.role}</Table.Td>
    </Table.Tr>
  ));

  return (
    <Paper radius="md" p="sm" withBorder>
      <Title order={1}>{company.name}</Title>
      <Divider my="sm" />
      <Title order={3}>
        Company Users
      </Title>
      {usersLoading && <Loading />}
      {!!usersError && <Text c="red">Error loading users. Please try again later.</Text>}
      {users && users.length > 0 ?
          <ScrollArea>
              <TextInput
                  placeholder="Search by any field"
                  mb="md"
                  leftSection={<IconSearch size={16} stroke={1.5} />}
                  value={search}
                  onChange={handleSearchChange}
              />
              <Table horizontalSpacing="md" verticalSpacing="xs" miw={700} layout="fixed">
                  <Table.Tbody>
                      <Table.Tr>
                          <Th
                              sorted={sortBy === 'name'}
                              reversed={reverseSortDirection}
                              onSort={() => setSorting('name')}
                          >
                              Name
                          </Th>
                          <Th
                              sorted={sortBy === 'email'}
                              reversed={reverseSortDirection}
                              onSort={() => setSorting('email')}
                          >
                              Email
                          </Th>
                          <Th
                              sorted={sortBy === 'role'}
                              reversed={reverseSortDirection}
                              onSort={() => setSorting('role')}
                          >
                              Company
                          </Th>
                      </Table.Tr>
                  </Table.Tbody>
                  <Table.Tbody>
                    {rows.length > 0 ? (
                      rows
                    ) : (
                      <Table.Tr>
                        <Table.Td colSpan={3}>
                          <Text fw={500} ta="center">
                            Nothing found
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
              </Table>
          </ScrollArea>
          : <Text mt="md">No users found in this company.</Text>
      }
    </Paper>
  );
};
