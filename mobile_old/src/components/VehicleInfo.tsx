import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, useTheme } from 'react-native-paper';
import { Vehicle } from '../types/vehicle.types';

interface VehicleInfoProps {
  vehicle: Vehicle;
}

const VehicleInfo: React.FC<VehicleInfoProps> = ({ vehicle }) => {
  const theme = useTheme();

  return (
    <Card style={[{ backgroundColor: theme.colors.surface }, styles.card]}>
      <Card.Content>
        <Title>Assigned Vehicle</Title>
        <Paragraph>Manufacturer: {vehicle.manufacturer}</Paragraph>
        <Paragraph>Model: {vehicle.modelName}</Paragraph>
        <Paragraph>Number: {vehicle.number}</Paragraph>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
  },
});

export default VehicleInfo;
