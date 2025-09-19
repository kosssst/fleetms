import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { bluetoothService } from '../services/bluetooth.service';
import { BluetoothDevice } from 'react-native-bluetooth-classic';

type ConnectionStatus = 'disconnected' | 'searching' | 'connected' | 'error';

interface BluetoothContextData {
  connectionStatus: ConnectionStatus;
  device: BluetoothDevice | null;
  logs: string[];
  startSearch: () => void;
  stopSearch: () => void;
}

const BluetoothContext = createContext<BluetoothContextData>({} as BluetoothContextData);

export const BluetoothProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [`[${timestamp}] ${message}`, ...prevLogs.slice(0, 100)]);
  }, []);

  const startSearch = async () => {
    setLogs([]);
    const permissionsGranted = await bluetoothService.requestPermissions(addLog);
    if (!permissionsGranted) {
      setConnectionStatus('error');
      return;
    }

    bluetoothService.startSearch(
      (status) => setConnectionStatus(status),
      (foundDevice) => setDevice(foundDevice),
      (message) => addLog(message)
    );
  };

  const stopSearch = () => {
    bluetoothService.stopSearch(
      (status) => setConnectionStatus(status),
      (message) => addLog(message)
    );
  };

  return (
    <BluetoothContext.Provider value={{ connectionStatus, device, logs, startSearch, stopSearch }}>
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = () => {
  return useContext(BluetoothContext);
};
