"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getTripById, reanalyzeTrip, deleteTrip } from '@/services/trip.service';
import { Trip } from '@/types/trip.types';
import { Paper, Title, Text, Grid, Button, Group } from '@mantine/core';
import { MapContainer, TileLayer, Polyline, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const TripDetailsPage = () => {
  const { id } = useParams();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatDuration = (totalSeconds: number) => {
    const seconds = Math.round(totalSeconds);
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    let formatted = '';
    if (days > 0) formatted += `${days}d `;
    if (hours > 0) formatted += `${hours}h `;
    if (minutes > 0) formatted += `${minutes}m `;
    formatted += `${remainingSeconds}s`;

    return formatted.trim();
  };

  const handleReanalyze = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      await reanalyzeTrip(id as string);
      window.location.reload();
    } catch {
      setError('Failed to reanalyze trip');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (window.confirm('Are you sure you want to delete this trip?')) {
      setLoading(true);
      setError(null);
      try {
        await deleteTrip(id as string);
        router.push('/company/trips');
      } catch {
        setError('Failed to delete trip');
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (id) {
      const fetchTripDetails = async () => {
        const tripData = await getTripById(id as string);
        setTrip(tripData);
      };
      fetchTripDetails();
    }
  }, [id]);

  if (!trip) {
    return <div>Loading...</div>;
  }

  const route = trip.summary?.route.map(point => [point.longitude, point.latitude]) || [];

  return (
    <div className="main-context">
      <Button onClick={() => router.back()} mb="md">
        Return
      </Button>
      <Group justify="apart" mb="md">
        <Title order={2}>Trip Details</Title>
        <Group>
          <Button onClick={handleReanalyze} disabled={loading}>
            {loading ? 'Reanalyzing...' : 'Re-analyze'}
          </Button>
          <Button color="red" onClick={handleDelete} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </Button>
        </Group>
      </Group>
      {error && <Text color="red">{error}</Text>}
      <Grid>
        <Grid.Col span={8}>
          <Paper withBorder radius="md" p="md" style={{ height: '400px' }}>
            {route.length > 0 && (
              <MapContainer center={route[0] as [number, number]} zoom={13} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {route.length > 1 ? (
                  <Polyline positions={route as [number, number][]} weight={5} />
                ) : (
                  <CircleMarker center={route[0] as [number, number]} radius={5} color="red" />
                )}
              </MapContainer>
            )}
          </Paper>
        </Grid.Col>
        <Grid.Col span={4}>
          <Paper withBorder radius="md" p="md">
            <Title order={3}>Summary</Title>
            {trip.summary ? (
              <>
                <Text>Duration: {formatDuration(trip.summary.durationSec)}</Text>
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
          <Paper withBorder radius="md" p="md" mt="md">
            <Title order={3}>Prediction Summary</Title>
            {trip.predictionSummary ? (
              <>
                <Text>Fuel Used: {trip.predictionSummary.fuelUsedL}L</Text>
                <Text>Average Fuel Rate: {trip.predictionSummary.avgFuelRateLph}L/h</Text>
                <Text>MAE: {trip.predictionSummary.MAE}</Text>
                <Text>RMSE: {trip.predictionSummary.RMSE}</Text>
                <Text>R²: {trip.predictionSummary.R2}</Text>
              </>
            ) : (
              <Text>Prediction summary not available.</Text>
            )}
          </Paper>
        </Grid.Col>
      </Grid>
    </div>
  );
};

export default TripDetailsPage;
