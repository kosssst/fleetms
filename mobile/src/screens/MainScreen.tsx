import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Title, Paragraph, useTheme } from 'react-native-paper';
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
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const { connectionStatus: bluetoothStatus } = useBluetooth();
  const { socketStatus } = useSocket();

  const {
    obdData,
    tripStatus,
    startTrip,
    pauseTrip,
    resumeTrip,
    endTrip,
  } = useOBD(user?.token || '', vehicle?.numberOfCylinders || 0);

  useEffect(() => {
    const fetchVehicle = async () => {
      const assignedVehicle = await getAssignedVehicle();
      setVehicle(assignedVehicle);
    };

    fetchVehicle();
  }, []);

  const isConnected = bluetoothStatus === 'connected' && socketStatus === 'connected';

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ConnectionStatus />
      <Card style={{ backgroundColor: theme.colors.surface, marginBottom: 16 }}>
        <Card.Content>
          <Title>Welcome, {user?.firstName}!</Title>
          <Paragraph>Role: {user?.role}</Paragraph>
        </Card.Content>
      </Card>

      {vehicle && <VehicleInfo vehicle={vehicle} />}

      <View style={styles.tripControls}>
        {tripStatus === 'stopped' && (
          <Button mode="contained" onPress={startTrip} style={styles.button} disabled={!isConnected}>
            Start Trip
          </Button>
        )}
        {tripStatus === 'ongoing' && (
          <Button mode="contained" onPress={pauseTrip} style={styles.button}>
            Pause Trip
          </Button>
        )}
        {tripStatus === 'paused' && (
          <Button mode="contained" onPress={resumeTrip} style={styles.button}>
            Resume Trip
          </Button>
        )}
        {(tripStatus === 'ongoing' || tripStatus === 'paused') && (
          <Button mode="contained" onPress={endTrip} style={styles.button}>
            End Trip
          </Button>
        )}
      </View>

      {tripStatus === 'ongoing' && obdData && (
        <Card style={{ backgroundColor: theme.colors.surface, marginTop: 16 }}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  button: {
    marginTop: 16,
  },
  tripControls: {
    marginTop: 16,
  },
});

export default MainScreen;