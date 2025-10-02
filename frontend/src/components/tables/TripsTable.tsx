"use client";

import { useEffect, useState } from 'react';
import { Table, Button, HoverCard, Text } from '@mantine/core';
import { useRouter } from 'next/navigation';
import { getTrips } from '@/services/trip.service';
import { Trip } from '@/types/trip.types';

export const TripsTable = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const router = useRouter();

  useEffect(() => {
    const fetchTrips = async () => {
      const companyTrips = await getTrips();
      setTrips(companyTrips);
    };

    fetchTrips();
  }, []);

  const rows = trips.map((trip) => (
    <Table.Tr key={trip.id}>
      <Table.Td>{trip.status}</Table.Td>
      <Table.Td>{new Date(trip.startTime).toLocaleString()}</Table.Td>
      <Table.Td>{trip.endTime ? new Date(trip.endTime).toLocaleString() : 'N/A'}</Table.Td>
      <Table.Td>{`${trip.driverId.firstName} ${trip.driverId.lastName}`}</Table.Td>
      <Table.Td>{trip.vehicleId.number}</Table.Td>
      <Table.Td>
        {trip.status === 'completed' && (
          <HoverCard width={280} shadow="md">
            <HoverCard.Target>
              <Button onClick={() => router.push(`/trips/${trip.id}`)}>
                View Details
              </Button>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Text size="sm">
                View the details of this trip, including the route and summary.
              </Text>
            </HoverCard.Dropdown>
          </HoverCard>
        )}
      </Table.Td>
    </Table.Tr>
  ));

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Status</Table.Th>
          <Table.Th>Started At</Table.Th>
          <Table.Th>Ended At</Table.Th>
          <Table.Th>Driver</Table.Th>
          <Table.Th>Vehicle Number</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>{rows}</Table.Tbody>
    </Table>
  );
};
