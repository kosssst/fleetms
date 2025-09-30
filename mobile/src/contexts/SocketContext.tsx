import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import { webSocketService } from '../services/WebSocketService';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SocketStatus = 'connected' | 'disconnected' | 'connecting';

interface SocketContextData {
  socketStatus: SocketStatus;
  logs: string[];
  authenticate: (token: string) => void;
  startTrip: () => Promise<string | null>;
  pauseTrip: () => void;
  resumeTrip: () => Promise<void>;
  endTrip: () => void;
}

const SocketContext = createContext<SocketContextData>({} as SocketContextData);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [logs, setLogs] = useState<string[]>([]);
  const appState = useRef(AppState.currentState);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setLogs(prevLogs => [logMessage, ...prevLogs.slice(0, 100)]);
  }, []);

  useEffect(() => {
    webSocketService.connect(addLog);

    const statusInterval = setInterval(() => {
      const status = webSocketService.getStatus();
      setSocketStatus(status);
    }, 1000);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        addLog('App has come to the foreground, checking socket status...');
        if (!webSocketService.isConnected()) {
          addLog('Socket disconnected, attempting to reconnect.');
          webSocketService.connect();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      clearInterval(statusInterval);
      subscription.remove();
      webSocketService.disconnect();
    };
  }, [addLog]);

  const authenticate = useCallback((token: string) => {
    webSocketService.authenticate(token);
  }, []);

  const startTrip = async (): Promise<string | null> => {
    webSocketService.startTrip();
    await new Promise(resolve => setTimeout(resolve, 1000));
    const tripId = webSocketService.getTripId();
    if (tripId) {
      await AsyncStorage.setItem('activeTripId', tripId);
    }
    return tripId;
  };

  const pauseTrip = () => {
    webSocketService.pauseTrip();
  };

  const resumeTrip = async () => {
    const tripId = await AsyncStorage.getItem('activeTripId');
    if (tripId) {
      webSocketService.resumeTrip();
    }
  };

  const endTrip = async () => {
    webSocketService.endTrip();
    await AsyncStorage.removeItem('activeTripId');
  };

  return (
    <SocketContext.Provider
      value={{
        socketStatus,
        logs,
        authenticate,
        startTrip,
        pauseTrip,
        resumeTrip,
        endTrip,
      }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};