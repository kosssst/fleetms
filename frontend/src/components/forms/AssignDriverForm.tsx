
'use client';

import React, { useState, useEffect } from 'react';
import { Vehicle } from '@/types/vehicle.types';
import { User } from '@/types/user.types';
import { getCompanyUsers } from '@/services/company.service';
import { useAuth } from '@/context/AuthContext';
import { Modal, Select, Button, Group } from '@mantine/core';
import { useForm } from '@mantine/form';

interface AssignDriverFormProps {
  vehicle: Vehicle;
  onSubmit: (vehicleId: string, driverId: string) => void;
  onClose: () => void;
}

const AssignDriverForm: React.FC<AssignDriverFormProps> = ({ vehicle, onSubmit, onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const { user } = useAuth();

  const form = useForm({
    initialValues: {
      driverId: '',
    },
    validate: {
      driverId: (value) => (value ? null : 'You must select a driver'),
    },
  });

  useEffect(() => {
    const fetchUsers = async () => {
      if (user && user.companyId) {
        try {
          const companyUsers = await getCompanyUsers();
          const drivers = companyUsers.filter((user) => user.role === 'driver');
          setUsers(drivers);
        } catch (error) {
          console.error('Failed to fetch company users', error);
        }
      }
    };

    fetchUsers();
  }, [user]);

  const handleSubmit = (values: typeof form.values) => {
    onSubmit(vehicle.id, values.driverId);
  };

  const userOptions = users.map((user) => ({
    value: user._id,
    label: `${user.firstName} ${user.lastName}`,
  }));

  return (
    <Modal opened={true} onClose={onClose} title={`Assign Driver for ${vehicle.manufacturer} ${vehicle.modelName}`}>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Select
          label="Driver"
          placeholder="Select a driver"
          data={userOptions}
          {...form.getInputProps('driverId')}
          required
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Assign</Button>
        </Group>
      </form>
    </Modal>
  );
};

export default AssignDriverForm;
