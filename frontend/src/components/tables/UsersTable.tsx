
'use client';

import {
  Table,
  ScrollArea,
  TextInput,
  UnstyledButton,
  Group,
  Center,
  Text,
  keys,
  Select,
} from '@mantine/core';
import { useCompanyUsers } from '@/hooks/useCompanyUsers';
import { Loading } from '@/components/common/Loading';
import { useEffect, useState } from 'react';
import { IconChevronDown, IconChevronUp, IconSearch, IconSelector } from '@tabler/icons-react';
import { USER_ROLE_DISPLAY_NAMES, UserRole } from '@/constants/userRoles';
import classes from '../../styles/UsersTable.module.scss';
import { useAuth } from '@/context/AuthContext';
import { updateUserRole } from '@/services/user.service';

interface UsersTableProps {
  companyId: string;
}

interface RowData {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  isOwner: boolean;
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
    keys(data[0]).some((key) => {
      if (typeof item[key] === 'string') {
        return item[key].toLowerCase().includes(query);
      }
      return false;
    })
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
        return b[sortBy].toString().localeCompare(a[sortBy].toString());
      }
      return a[sortBy].toString().localeCompare(b[sortBy].toString());
    }),
    payload.search
  );
}

const availableRoles = Object.entries(USER_ROLE_DISPLAY_NAMES)
  .filter(([key]) => key !== 'company_owner' && key !== 'admin')
  .map(([value, label]) => ({ value, label }));

export const UsersTable = ({ companyId }: UsersTableProps) => {
  const { user: currentUser } = useAuth();
  const { users, loading, error, setUsers } = useCompanyUsers(companyId);
  const [search, setSearch] = useState('');
  const [sortedData, setSortedData] = useState<RowData[]>([]);
  const [sortBy, setSortBy] = useState<keyof RowData | null>(null);
  const [reverseSortDirection, setReverseSortDirection] = useState(false);

  useEffect(() => {
    if (users) {
      const initialData: RowData[] = users.map((user) => ({
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
        isOwner: user.role === 'company_owner',
      }));
      setSortedData(sortData(initialData, { sortBy, reversed: reverseSortDirection, search }));
    }
  }, [users, sortBy, reverseSortDirection, search]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const updatedUser = await updateUserRole(userId, newRole);
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user._id === updatedUser._id ? updatedUser : user))
      );
    } catch (err) {
      console.error('Failed to update user role:', err);
      // Optionally, show an error message to the user
    }
  };

  const setSorting = (field: keyof RowData) => {
    const reversed = field === sortBy ? !reverseSortDirection : false;
    setReverseSortDirection(reversed);
    setSortBy(field);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setSearch(value);
  };

  if (loading) return <Loading />;
  if (error) return <Text c="red">Error loading users.</Text>;

  const canEditRoles = currentUser?.role === 'company_owner' || currentUser?.role === 'logist';

  const rows = sortedData.map((row) => {
    const isCurrentUser = row._id === currentUser?._id;
    const isTargetOwner = row.isOwner;
    const isRequesterLogist = currentUser?.role === 'logist';

    const canChangeThisUserRole = canEditRoles && !isCurrentUser && !(isRequesterLogist && isTargetOwner);

    return (
      <Table.Tr key={row.name}>
        <Table.Td>{row.name}</Table.Td>
        <Table.Td>{row.email}</Table.Td>
        <Table.Td>
          {canChangeThisUserRole ? (
            <Select
              data={availableRoles}
              value={row.role}
              onChange={(value) => handleRoleChange(row._id, value || '')}
            />
          ) : (
            USER_ROLE_DISPLAY_NAMES[row.role]
          )}
        </Table.Td>
      </Table.Tr>
    );
  });

  return (
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
            <Th sorted={sortBy === 'name'} reversed={reverseSortDirection} onSort={() => setSorting('name')}>
              Name
            </Th>
            <Th sorted={sortBy === 'email'} reversed={reverseSortDirection} onSort={() => setSorting('email')}>
              Email
            </Th>
            <Th sorted={sortBy === 'role'} reversed={reverseSortDirection} onSort={() => setSorting('role')}>
              Role
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
  );
};
