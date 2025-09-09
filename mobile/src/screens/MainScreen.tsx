import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Title, Paragraph, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import ConnectionStatus from '../components/ConnectionStatus';
import VehicleInfo from '../components/VehicleInfo';
import { getAssignedVehicle } from '../services/vehicle.service';
import { Vehicle } from '../types/vehicle.types';

const MainScreen = () => {
  const { user, logout } = useAuth();
  const theme = useTheme();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);

  useEffect(() => {
    const fetchVehicle = async () => {
      const assignedVehicle = await getAssignedVehicle();
      setVehicle(assignedVehicle);
    };

    fetchVehicle();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ConnectionStatus />
      <Card style={{ backgroundColor: theme.colors.surface }}>
        <Card.Content>
          <Title>Welcome, {user?.firstName}!</Title>
          <Paragraph>Email: {user?.email}</Paragraph>
          <Paragraph>Role: {user?.role}</Paragraph>
        </Card.Content>
      </Card>
      {vehicle && <VehicleInfo vehicle={vehicle} />}
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
});

export default MainScreen;