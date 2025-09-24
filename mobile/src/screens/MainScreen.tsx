import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Title, Paragraph, useTheme, MD3Theme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { useBluetooth } from '../contexts/BluetoothContext';
import { useSocket } from '../contexts/SocketContext';
import ConnectionStatus from '../components/ConnectionStatus';
import VehicleInfo from '../components/VehicleInfo';
import { getAssignedVehicle } from '../services/vehicle.service';
import { Vehicle } from '../types/vehicle.types';
import { useOBD } from '../hooks/useOBD';

const MainScreen = () => {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const styles = createStyles(theme);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const { connectionStatus: bluetoothStatus } = useBluetooth();
  const { socketStatus, startTrip, pauseTrip, resumeTrip, endTrip } = useSocket();
  const [tripStatus, setTripStatus] = useState<'stopped' | 'ongoing' | 'paused'>('stopped');

  const { obdData } = useOBD(tripStatus, vehicle?.numberOfCylinders || 0);

  useEffect(() => {
    const fetchVehicle = async () => {
      const assignedVehicle = await getAssignedVehicle();
      setVehicle(assignedVehicle);
    };

    fetchVehicle();
  }, []);

  const handleStartTrip = () => {
    startTrip();
    setTripStatus('ongoing');
  };

  const handlePauseTrip = () => {
    pauseTrip();
    setTripStatus('paused');
  };

  const handleResumeTrip = () => {
    resumeTrip();
    setTripStatus('ongoing');
  };

  const handleEndTrip = () => {
    endTrip();
    setTripStatus('stopped');
  };

  const isConnected = bluetoothStatus === 'connected' && socketStatus === 'connected';

  return (
    <View style={styles.container}>
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
          <Button mode="contained" onPress={handleStartTrip} style={styles.button} disabled={!isConnected}>
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
            <Paragraph>Vehicle Speed: {obdData.vehicle_speed}</Paragraph>
            <Paragraph>Engine RPM: {obdData.engine_speed}</Paragraph>
            <Paragraph>Fuel Consumption Rate: {obdData.fuel_consumption_rate}</Paragraph>
          </Card.Content>
        </Card>
      )}

      <Button mode="contained" onPress={logout} style={styles.button}>
        Logout
      </Button>
    </View>
  );
};

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
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
  }
});

export default MainScreen;