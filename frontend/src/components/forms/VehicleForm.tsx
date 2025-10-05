
'use client';

import React, { useEffect } from 'react';
import { Vehicle } from '@/types/vehicle.types';
import { Modal, TextInput, Button, Group } from '@mantine/core';
import { useForm } from '@mantine/form';

interface VehicleFormProps {
  vehicle?: Vehicle | null;
  onSubmit: (vehicle: Omit<Vehicle, 'id' | 'companyId' | 'driverId' | 'createdAt' | 'updatedAt'>) => void;
  onClose: () => void;
}

const VehicleForm: React.FC<VehicleFormProps> = ({ vehicle, onSubmit, onClose }) => {
  const form = useForm({
    initialValues: {
      manufacturer: '',
      modelName: '',
      number: '',
      numberOfCylinders: 0,
    },
    validate: {
      manufacturer: (value) => (value.length < 2 ? 'Manufacturer must have at least 2 letters' : null),
      modelName: (value) => (value.length < 2 ? 'Model must have at least 2 letters' : null),
      number: (value) => (value.length < 2 ? 'Number must have at least 2 letters' : null),
      numberOfCylinders: (value) => (value > 0 ? null : 'Number of cylinders must be a positive number'),
    },
  });

  useEffect(() => {
    if (vehicle) {
      form.setValues({
        manufacturer: vehicle.manufacturer,
        modelName: vehicle.modelName,
        number: vehicle.number,
        numberOfCylinders: vehicle.numberOfCylinders,
      });
    }
  }, [vehicle, form]);

  const handleSubmit = (values: typeof form.values) => {
    onSubmit(values);
  };

  return (
    <Modal opened={true} onClose={onClose} title={vehicle ? 'Edit Vehicle' : 'Add Vehicle'}>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <TextInput
          label="Manufacturer"
          placeholder="Enter manufacturer"
          {...form.getInputProps('manufacturer')}
          required
        />
        <TextInput
          label="Model"
          placeholder="Enter model"
          {...form.getInputProps('modelName')}
          required
          mt="md"
        />
        <TextInput
          label="Number"
          placeholder="Enter vehicle number"
          {...form.getInputProps('number')}
          required
          mt="md"
        />
        <TextInput
          label="Number of Cylinders"
          placeholder="Enter number of cylinders"
          type="number"
          {...form.getInputProps('numberOfCylinders')}
          required
          mt="md"
        />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">{vehicle ? 'Update' : 'Create'}</Button>
        </Group>
      </form>
    </Modal>
  );
};

export default VehicleForm;
