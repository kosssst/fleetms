
'use client';

import React, { useState, useEffect } from 'react';
import { getVehicles, deleteVehicle, createVehicle, updateVehicle, assignVehicle } from '@/services/vehicle.service';
import { Vehicle } from '@/types/vehicle.types';
import { useAuth } from '@/context/AuthContext';
import { User } from '@/types/user.types';
import VehicleForm from '@/components/forms/VehicleForm';
import AssignDriverForm from '@/components/forms/AssignDriverForm';
import { Button, Table, ScrollArea, Modal, Group, Text } from '@mantine/core';

export const VehiclesTable = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isVehicleFormOpen, setIsVehicleFormOpen] = useState(false);
  const [isAssignDriverFormOpen, setIsAssignDriverFormOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const data = await getVehicles();
        setVehicles(data);
      } catch (error) {
        console.error('Failed to fetch vehicles', error);
      }
    };

    fetchVehicles();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteVehicle(id);
      setVehicles(vehicles.filter((v) => v.id !== id));
    } catch (error) {
      console.error('Failed to delete vehicle', error);
      alert('Failed to delete vehicle');
    } finally {
      setIsDeleteModalOpen(false);
      setVehicleToDelete(null);
    }
  };

  const openDeleteModal = (id: string) => {
    setVehicleToDelete(id);
    setIsDeleteModalOpen(true);
  };

  const handleVehicleFormSubmit = async (vehicleData: Omit<Vehicle, 'id' | 'companyId' | 'driverId' | 'createdAt' | 'updatedAt'>) => {
    try {
      if (selectedVehicle) {
        const updatedVehicle = await updateVehicle(selectedVehicle.id, vehicleData);
        setVehicles(vehicles.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v)));
      } else {
        const newVehicle = await createVehicle(vehicleData);
        setVehicles([...vehicles, newVehicle]);
      }
      setIsVehicleFormOpen(false);
      setSelectedVehicle(null);
    } catch (error) {
      console.error('Failed to save vehicle', error);
    }
  };

  const handleAssignDriverFormSubmit = async (vehicleId: string, driverId: string) => {
    try {
      const updatedVehicle = await assignVehicle(vehicleId, driverId);
      setVehicles(vehicles.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v)));
      setIsAssignDriverFormOpen(false);
      setSelectedVehicle(null);
    } catch (error) {
      console.error('Failed to assign driver', error);
    }
  };

  const canManage = user?.role === 'company_owner' || user?.role === 'logist';

  return (
    <div>
      {canManage && (
        <Button
          onClick={() => {
            setSelectedVehicle(null);
            setIsVehicleFormOpen(true);
          }}
          mb="md"
        >
          Add Vehicle
        </Button>
      )}
      <ScrollArea>
        <Table horizontalSpacing="md" verticalSpacing="xs" miw={700} layout="fixed">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Manufacturer</Table.Th>
              <Table.Th>Model</Table.Th>
              <Table.Th>Number</Table.Th>
              <Table.Th>Driver</Table.Th>
              {canManage && <Table.Th>Actions</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {vehicles.map((vehicle) => (
              <Table.Tr key={vehicle.id}>
                <Table.Td>{vehicle.manufacturer}</Table.Td>
                <Table.Td>{vehicle.modelName}</Table.Td>
                <Table.Td>{vehicle.number}</Table.Td>
                <Table.Td>{vehicle.driverId ? `${(vehicle.driverId as User).firstName} ${(vehicle.driverId as User).lastName}` : 'Unassigned'}</Table.Td>
                {canManage && (
                  <Table.Td>
                    <Button
                      variant="outline"
                      size="xs"
                      mr="xs"
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        setIsVehicleFormOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      color="red"
                      size="xs"
                      mr="xs"
                      onClick={() => openDeleteModal(vehicle.id)}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="outline"
                      color="green"
                      size="xs"
                      onClick={() => {
                        setSelectedVehicle(vehicle);
                        setIsAssignDriverFormOpen(true);
                      }}
                    >
                      Assign Driver
                    </Button>
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
      {isVehicleFormOpen && (
        <VehicleForm
          vehicle={selectedVehicle}
          onSubmit={handleVehicleFormSubmit}
          onClose={() => {
            setIsVehicleFormOpen(false);
            setSelectedVehicle(null);
          }}
        />
      )}
      {isAssignDriverFormOpen && selectedVehicle && (
        <AssignDriverForm
          vehicle={selectedVehicle}
          onSubmit={handleAssignDriverFormSubmit}
          onClose={() => {
            setIsAssignDriverFormOpen(false);
            setSelectedVehicle(null);
          }}
        />
      )}
      <Modal
        opened={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setVehicleToDelete(null);
        }}
        title="Confirm Deletion"
      >
        <Text>Are you sure you want to delete this vehicle?</Text>
        <Group justify="flex-end" mt="md">
          <Button
            variant="default"
            onClick={() => {
              setIsDeleteModalOpen(false);
              setVehicleToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={() => {
              if (vehicleToDelete) {
                handleDelete(vehicleToDelete);
              }
            }}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </div>
  );
};
