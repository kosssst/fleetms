import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useBluetooth } from '../contexts/BluetoothContext';
import { useSocket } from '../contexts/SocketContext';
import { useTheme, Card, Title, Button, Text } from 'react-native-paper';

const ConnectionStatus: React.FC = () => {
  const { connectionStatus: bluetoothStatus, logs: bluetoothLogs = [], startSearch, stopSearch } = useBluetooth();
  const { socketStatus, logs: socketLogs = [] } = useSocket();
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);

  const isSearching = bluetoothStatus === 'searching';

  useEffect(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, [bluetoothLogs, socketLogs]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'connected':
        return { backgroundColor: 'green' };
      case 'connecting':
      case 'searching':
        return { backgroundColor: 'yellow' };
      default:
        return { backgroundColor: theme.colors.error };
    }
  };

  const combinedLogs = [...(socketLogs || []), ...(bluetoothLogs || [])].sort((a, b) => {
    const timeA = a.match(/\\[(.*?)\\]/)?.[1];
    const timeB = b.match(/\\[(.*?)\\]/)?.[1];
    if (timeA && timeB) {
      // A simple string sort is enough if the timestamp format is consistent
      return timeA.localeCompare(timeB);
    }
    return 0;
  });

  return (
    <Card style={{ margin: 16, backgroundColor: theme.colors.surface }}>
      <Card.Content>
        <View style={styles.statusContainer}>
          <View style={[styles.circle, getStatusStyle(socketStatus)]} />
          <Title style={{ color: theme.colors.onSurface, marginLeft: 12 }}>
            Socket: {socketStatus}
          </Title>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.circle, getStatusStyle(bluetoothStatus)]} />
          <Title style={{ color: theme.colors.onSurface, marginLeft: 12 }}>
            Bluetooth: {bluetoothStatus}
          </Title>
        </View>
        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={startSearch}
            disabled={isSearching || bluetoothStatus === 'connected'}
            style={styles.button}
          >
            Start Search
          </Button>
          <Button
            mode="outlined"
            onPress={stopSearch}
            disabled={!isSearching && bluetoothStatus !== 'connected'}
            style={styles.button}
          >
            Stop Search
          </Button>
        </View>
        <View style={[styles.logContainer, { borderColor: theme.colors.outline }]}>
          <ScrollView ref={scrollViewRef} nestedScrollEnabled={true}>
            {combinedLogs.map((log, index) => (
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
