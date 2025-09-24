import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, NativeScrollEvent } from 'react-native';
import { useBluetooth } from '../contexts/BluetoothContext';
import { useSocket } from '../contexts/SocketContext';
import { useTheme, Card, Title, Button, Text, MD3Theme } from 'react-native-paper';

const ConnectionStatus: React.FC = () => {
  const { connectionStatus: bluetoothStatus, logs: bluetoothLogs = [], startSearch, stopSearch } = useBluetooth();
  const { socketStatus, logs: socketLogs = [], connectSocket, disconnectSocket } = useSocket();
  const theme = useTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  const styles = createStyles(theme);
  const isSearching = bluetoothStatus === 'searching';

  // Sort oldest first, so newest appears at the bottom
  const combinedLogs = useMemo(() => [...(socketLogs || []), ...(bluetoothLogs || [])].sort((a, b) => {
    const timeA = a.match(/\\\[(.*?)\\\]/)?.[1];
    const timeB = b.match(/\\\[(.*?)\\\]/)?.[1];
    if (timeA && timeB) {
      return timeA.localeCompare(timeB);
    }
    return 0;
  }), [socketLogs, bluetoothLogs]);

  const handleScroll = (event: NativeScrollEvent) => {
    setUserHasScrolled(true);
    const { layoutMeasurement, contentOffset, contentSize } = event;
    const paddingToBottom = 20; // A small tolerance
    const isScrolledToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    if (isScrolledToBottom) {
      setUserHasScrolled(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'connected':
        return styles.statusConnected;
      case 'connecting':
      case 'searching':
        return styles.statusConnecting;
      default:
        return styles.statusError;
    }
  };

  return (
    <Card style={styles.card}>
      <Card.Content>
        <View style={styles.statusContainer}>
          <View style={[styles.circle, getStatusStyle(socketStatus)]} />
          <Title style={styles.title}>
            Socket: {socketStatus}
          </Title>
        </View>
        <View style={styles.buttonContainer}>
          {socketStatus === 'connected' ? (
            <Button mode="outlined" onPress={disconnectSocket} style={styles.button}>
              Disconnect Socket
            </Button>
          ) : (
            <Button
              mode="outlined"
              onPress={connectSocket}
              style={styles.button}
              disabled={socketStatus === 'connecting'}
            >
              Connect Socket
            </Button>
          )}
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.circle, getStatusStyle(bluetoothStatus)]} />
          <Title style={styles.title}>
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
        <View style={styles.logContainer}>
          <ScrollView
            ref={scrollViewRef}
            nestedScrollEnabled={true}
            onScroll={({ nativeEvent }) => handleScroll(nativeEvent)}
            scrollEventThrottle={400}
            onContentSizeChange={() => {
              if (!userHasScrolled) {
                scrollViewRef.current?.scrollToEnd({ animated: true });
              }
            }}
          >
            {combinedLogs.map((log, index) => (
              <Text key={`${log}-${index}`} style={styles.logText}>
                {log}
              </Text>
            ))}
          </ScrollView>
        </View>
      </Card.Content>
    </Card>
  );
};

const createStyles = (theme: MD3Theme) => StyleSheet.create({
  card: {
    margin: 16,
    backgroundColor: theme.colors.surface,
  },
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
  title: {
    color: theme.colors.onSurface,
    marginLeft: 12,
  },
  statusConnected: {
    backgroundColor: 'green',
  },
  statusConnecting: {
    backgroundColor: 'yellow',
  },
  statusError: {
    backgroundColor: theme.colors.error,
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
    borderColor: theme.colors.outline,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: theme.colors.onSurfaceVariant,
  },
});

export default ConnectionStatus;
