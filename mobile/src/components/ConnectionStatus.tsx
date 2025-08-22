import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useBluetooth } from '../contexts/BluetoothContext';
import { useTheme, Card, Title, Button, Text } from 'react-native-paper';

const ConnectionStatus: React.FC = () => {
  const { connectionStatus, logs, startSearch, stopSearch } = useBluetooth();
  const theme = useTheme();

  const isSearching = connectionStatus === 'searching';

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return theme.colors.primary;
      case 'searching':
        return theme.colors.secondary;
      case 'disconnected':
        return theme.colors.error;
      case 'error':
        return theme.colors.error;
      default:
        return theme.colors.onSurfaceDisabled;
    }
  };

  return (
    <Card style={{ margin: 16, backgroundColor: theme.colors.surface }}>
      <Card.Content>
        <View style={styles.statusContainer}>
          <View style={[styles.circle, { backgroundColor: getStatusColor() }]} />
          <Title style={{ color: theme.colors.onSurface }}>
            Status: {connectionStatus}
          </Title>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={startSearch}
            disabled={isSearching || connectionStatus === 'connected'}
            style={styles.button}
          >
            Start Search
          </Button>
          <Button
            mode="outlined"
            onPress={stopSearch}
            disabled={!isSearching && connectionStatus !== 'connected'}
            style={styles.button}
          >
            Stop Search
          </Button>
        </View>
        <View style={[styles.logContainer, { borderColor: theme.colors.outline }]}>
          <ScrollView nestedScrollEnabled={true}>
            {logs.map((log, index) => (
              <Text key={index} style={[styles.logText, { color: theme.colors.onSurfaceVariant }]}>
                {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  circle: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    marginRight: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  logContainer: {
    height: 150,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default ConnectionStatus;
