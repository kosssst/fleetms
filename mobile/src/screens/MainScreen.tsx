import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Button, Card, Title, Paragraph, useTheme, MD3Theme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useBluetooth } from '../contexts/BluetoothContext';
import { useSocket } from '../contexts/SocketContext';
import ConnectionStatus from '../components/ConnectionStatus';
import VehicleInfo from '../components/VehicleInfo';
import { getAssignedVehicle } from '../services/vehicle.service';
import { Vehicle } from '../types/vehicle.types';
import { useOBD } from '../hooks/useOBD';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BackgroundService from 'react-native-background-actions';
import { obdTask } from '../tasks/obdTask';

import { obdService } from '../services/obd.service';

import { locationService } from '../services/location.service';

import { senderTask } from '../tasks/senderTask';

const obdBackgroundOptions = {
  taskName: 'FleetMS OBD',
  taskTitle: 'OBD Connection Active',
  taskDesc: 'Polling for trip data.',
  taskIcon: {
    name: 'ic_launcher',
    type: 'mipmap',
  },
  color: '#009688',
  linkingURI: 'fleetms://',
};

const senderBackgroundOptions = {
    taskName: 'FleetMS Sender',
    taskTitle: 'Sender Active',
    taskDesc: 'Sending trip data.',
    taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
    },
    color: '#009688',
    linkingURI: 'fleetms://',
};

const MainScreen = () => {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const { connectionStatus: bluetoothStatus } = useBluetooth();
  const { socketStatus, startTrip, pauseTrip, resumeTrip, endTrip } = useSocket();
  const [tripStatus, setTripStatus] = useState<'stopped' | 'ongoing' | 'paused'>('stopped');
  const [isStartingTrip, setIsStartingTrip] = useState(false);

  const { obdData } = useOBD();
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    locationService.requestLocationPermission();

    const locationSubscription = locationService.subscribe((position) => {
      setLocation(position.coords);
    });

    const fetchVehicle = async () => {
      const assignedVehicle = await getAssignedVehicle();
      setVehicle(assignedVehicle);
    };

    const checkActiveTrip = async () => {
      const activeTripId = await AsyncStorage.getItem('activeTripId');
      if (activeTripId) {
        setTripStatus('ongoing');
      }
    };

    fetchVehicle();
    checkActiveTrip();

    return () => {
      locationSubscription.remove();
    };
  }, []);

  const handleStartTrip = async () => {
    setIsStartingTrip(true);
    const tripId = await startTrip();
    if (tripId) {
      try {
        const options = {
          ...obdBackgroundOptions,
          parameters: {
            tripId,
            numberOfCylinders: vehicle?.numberOfCylinders || 4,
          },
        };
        await BackgroundService.start(obdTask, options);
        await BackgroundService.start(senderTask, senderBackgroundOptions);
        setTripStatus('ongoing');
      } catch (e) {
        console.error('Failed to start background service', e);
      }
    }
    setIsStartingTrip(false);
  };

  const handlePauseTrip = () => {
    obdService.pauseTrip();
    pauseTrip();
    setTripStatus('paused');
  };

  const handleResumeTrip = async () => {
    await resumeTrip();
    try {
      obdService.startTrip();
      const options = {
        ...obdBackgroundOptions,
        parameters: {
          tripId: await AsyncStorage.getItem('activeTripId'),
          numberOfCylinders: vehicle?.numberOfCylinders || 0,
        },
      };
      await BackgroundService.start(obdTask, options);
      await BackgroundService.start(senderTask, senderBackgroundOptions);
      setTripStatus('ongoing');
    } catch (e) {
      console.error('Failed to start background service', e);
    }
  };

  const handleEndTrip = async () => {
    obdService.stopTrip();
    await obdService.stopPolling();
    if (BackgroundService.isRunning()) {
      await BackgroundService.stop();
    }
    await endTrip();
    setTripStatus('stopped');
  };

  const isConnected = bluetoothStatus === 'connected' && socketStatus === 'connected';

  return (
    <ScrollView style={styles.container}>
      <ConnectionStatus />
      <Card style={styles.welcomeCard}>
        <Card.Content>
          <Title>Welcome, {user?.firstName}!</Title>
          <Paragraph>Role: {user?.role}</Paragraph>
        </Card.Content>
      </Card>

      {vehicle && <VehicleInfo vehicle={vehicle} />}

      <View style={styles.tripControls}>
        {tripStatus === 'stopped' && (
          <Button mode="contained" onPress={handleStartTrip} style={styles.button} disabled={!isConnected || isStartingTrip}>
            Start Trip
          </Button>
        )}
        {tripStatus === 'ongoing' && (
          <Button mode="contained" onPress={handlePauseTrip} style={styles.button}>
            Pause Trip
          </Button>
        )}
        {tripStatus === 'paused' && (
          <Button mode="contained" onPress={handleResumeTrip} style={styles.button}>
            Resume Trip
          </Button>
        )}
        {(tripStatus === 'ongoing' || tripStatus === 'paused') && (
          <Button mode="contained" onPress={handleEndTrip} style={styles.button}>
            End Trip
          </Button>
        )}
      </View>

      {tripStatus === 'ongoing' && obdData && (
        <Card style={styles.obdCard}>
          <Card.Content>
            <Title>OBD Data</Title>
            <Paragraph>Vehicle Speed: {obdData.vehicle_speed} km/h</Paragraph>
            <Paragraph>Engine RPM: {obdData.engine_speed}</Paragraph>
            <Paragraph>Accelerator Position: {obdData.accelerator_position?.toFixed(0)}%</Paragraph>
            <Paragraph>Engine Coolant Temp: {obdData.engine_coolant_temp?.toFixed(0)}°C</Paragraph>
            <Paragraph>Intake Air Temp: {obdData.intake_air_temp?.toFixed(0)}°C</Paragraph>
            <Paragraph>Fuel Per Stroke: {obdData.fuel_per_stroke?.toFixed(2)} mg/stroke</Paragraph>
            <Paragraph>Fuel Consumption Rate: {(obdData.fuel_consumption_rate * (1000 / 3600))?.toFixed(2)} ml/s</Paragraph>
            {location && (
              <Paragraph>
                GPS: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
              </Paragraph>
            )}
          </Card.Content>
        </Card>
      )}

      <Button mode="contained" onPress={logout} style={styles.button}>
        Logout
      </Button>
    </ScrollView>
  );
};

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: theme.colors.background,
  },
  welcomeCard: {
    backgroundColor: theme.colors.surface,
    marginBottom: 16,
  },
  obdCard: {
    backgroundColor: theme.colors.surface,
    marginTop: 16,
  },
  button: {
    marginTop: 16,
  },
  tripControls: {
    marginTop: 16,
  },
  debugContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 8,
  },
  debugButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  errorContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: theme.colors.errorContainer,
  },
  errorText: {
    color: theme.colors.onError,
  },
});

export default MainScreen;