import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { obdService } from '../services/obd.service';
import { BluetoothDevice } from 'react-native-bluetooth-classic';
import BackgroundService from 'react-native-background-actions';
import { obdTask } from '../tasks/obdTask';

type ConnectionStatus = 'disconnected' | 'searching' | 'connected' | 'error';

interface BluetoothContextData {
  connectionStatus: ConnectionStatus;
  device: BluetoothDevice | null;
  logs: string[];
  startSearch: () => void;
  stopSearch: () => void;
}

const BluetoothContext = createContext<BluetoothContextData>({} as BluetoothContextData);

const backgroundOptions = {
    taskName: 'FleetMS OBD',
    taskTitle: 'OBD Connection Active',
    taskDesc: 'Keeping ELM327 session alive for trip data.',
    taskIcon: {
        name: 'ic_launcher',
        type: 'mipmap',
    },
    color: '#009688',
    linkingURI: 'fleetms://', // To open the app from the notification
};


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

  const handleStatusChange = useCallback((status: ConnectionStatus) => {
    // The service is started before the search. We only stop it on final failure/disconnection.
    if (status === 'disconnected' || status === 'error') {
        if (BackgroundService.isRunning()) {
            BackgroundService.stop();
            addLog('Background service stopped due to status change.');
        }
    }
    setConnectionStatus(status);
  }, [addLog]);


  const startSearch = async () => {
    setLogs([]);
    const permissionsGranted = await obdService.requestPermissions(addLog);
    if (!permissionsGranted) {
      setConnectionStatus('error');
      return;
    }

    // Start the background service BEFORE initiating the search
    try {
        if (!BackgroundService.isRunning()) {
            await BackgroundService.start(obdTask, backgroundOptions);
            addLog('Background service started for device search.');
        }
    } catch (e) {
        addLog('Failed to start background service.');
        console.error(e);
        return;
    }

    obdService.startSearch(
      handleStatusChange,
      (foundDevice) => setDevice(foundDevice),
      addLog
    );
  };

  const stopSearch = () => {
    obdService.stopSearch(
      handleStatusChange,
      addLog
    );
    // Also ensure service is stopped if user manually stops.
    if (BackgroundService.isRunning()) {
        BackgroundService.stop();
        addLog('Background service stopped by user.');
    }
  };

  useEffect(() => {
      // Ensure the service is stopped when the app is fully closed/provider unmounts
      return () => {
          if (BackgroundService.isRunning()) {
              BackgroundService.stop();
          }
      }
  }, []);

  return (
    <BluetoothContext.Provider value={{ connectionStatus, device, logs, startSearch, stopSearch }}>
      {children}
    </BluetoothContext.Provider>
  );
};

export const useBluetooth = () => {
  return useContext(BluetoothContext);
};