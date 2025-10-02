"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTripById } from '@/services/trip.service';
import { Trip } from '@/types/trip.types';
import { Paper, Title, Text, Grid, Button } from '@mantine/core';
import { MapContainer, TileLayer, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Sample } from '@/types/sample.types';
import { getSamplesForTrip } from '@/services/sample.service';

const TripDetailsPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [samples, setSamples] = useState<Sample[]>([]);

  useEffect(() => {
    if (id) {
      const fetchTripDetails = async () => {
        const tripData = await getTripById(id as string);
        setTrip(tripData);
        const sampleData = await getSamplesForTrip(id as string);
        setSamples(sampleData);
      };
      fetchTripDetails();
    }
  }, [id]);

  if (!trip) {
    return <div>Loading...</div>;
  }

  const route = samples.map(sample => [sample.gps.longitude, sample.gps.latitude]);

  return (
    <div className="main-context">
      <Button onClick={() => router.back()} mb="md">
        Return
      </Button>
      <Title order={2}>Trip Details</Title>
      <Grid>
        <Grid.Col span={8}>
          <Paper withBorder radius="md" p="md" style={{ height: '400px' }}>
            {route.length > 0 && (
              <MapContainer center={route[0] as [number, number]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Polyline positions={route as [number, number][]} />
              </MapContainer>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={4}>
          <Paper withBorder radius="md" p="md">
            <Title order={3}>Summary</Title>
            {trip.summary ? (
              <>
                <Text>Duration: {trip.summary.durationSec}s</Text>
                <Text>Distance: {trip.summary.distanceKm}km</Text>
                <Text>Average Speed: {trip.summary.avgSpeedKph}km/h</Text>
                <Text>Max Speed: {trip.summary.maxSpeedKph}km/h</Text>
                <Text>Average RPM: {trip.summary.avgRpm}</Text>
                <Text>Max RPM: {trip.summary.maxRpm}</Text>
                <Text>Fuel Used: {trip.summary.fuelUsedL}L</Text>
                <Text>Average Fuel Rate: {trip.summary.avgFuelRateLph}L/h</Text>
              </>
            ) : (
              <Text>Summary not available.</Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </div>
  );
};

export default TripDetailsPage;
