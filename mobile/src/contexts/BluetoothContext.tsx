import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { obdService } from '../services/obd.service';
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
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prevLogs => [logMessage, ...prevLogs.slice(0, 100)]);
  }, []);

  const startSearch = async () => {
    setLogs([]);
    const permissionsGranted = await obdService.requestPermissions(addLog);
    if (!permissionsGranted) {
      setConnectionStatus('error');
      return;
    }

    obdService.startSearch(
      setConnectionStatus,
      (foundDevice) => setDevice(foundDevice),
      addLog
    );
  };

  const stopSearch = () => {
    obdService.stopSearch(
      setConnectionStatus,
      addLog
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