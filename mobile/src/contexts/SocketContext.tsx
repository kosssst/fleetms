import React, { createContext, useContext, useState, ReactNode, useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { webSocketService } from '../services/WebSocketService';
import { useAuth } from './AuthContext';

type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface SocketContextData {
  socketStatus: SocketStatus;
  tripId: string | null;
  logs: string[];
  connectSocket: () => void;
  disconnectSocket: () => void;
  startTrip: () => void;
  pauseTrip: () => void;
  resumeTrip: () => void;
  endTrip: () => void;
}

const SocketContext = createContext<SocketContextData>({} as SocketContextData);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { token, loading, logout } = useAuth();
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [tripId, setTripId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnectionEnabled, setIsConnectionEnabled] = useState(false);
  const appState = useRef(AppState.currentState);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [`[${timestamp}] ${message}`, ...prevLogs.slice(0, 100)]);
  }, []);

  // Effect to set up service callbacks
  useEffect(() => {
    webSocketService.onStatusChange = setSocketStatus;
    webSocketService.onTripIdReceived = setTripId;
    webSocketService.onLog = addLog;
    webSocketService.onAuthError = () => {
      addLog("Authentication failed. Logging out.");
      logout();
    };
  }, [addLog, logout]);

  // Effect for managing the connection lifecycle
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        if (isConnectionEnabled && token && socketStatus !== 'connected') {
          webSocketService.connect(token);
        }
      }
      appState.current = nextAppState;
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    if (!loading) {
      if (isConnectionEnabled && token) {
        // Only connect if we are currently disconnected
        if (socketStatus === 'disconnected' || socketStatus === 'error') {
          webSocketService.connect(token);
        }
      } else {
        // Only disconnect if we are currently connected or connecting
        if (socketStatus === 'connected' || socketStatus === 'connecting') {
          webSocketService.disconnect();
        }
      }
    }

    return () => {
      subscription.remove();
    };
  }, [token, loading, isConnectionEnabled, socketStatus]);

  const connectSocket = () => setIsConnectionEnabled(true);
  const disconnectSocket = () => setIsConnectionEnabled(false);

  // Effect for handling trip resumption after connection
  useEffect(() => {
    if (socketStatus === 'connected') {
      webSocketService.onAuthOk = () => {
        if (tripId) {
          addLog('Socket authenticated, resuming trip...');
          webSocketService.resumeTrip(tripId);
        }
      };
    }
  }, [socketStatus, tripId, addLog]);

  const startTrip = () => webSocketService.startTrip();
  const pauseTrip = () => webSocketService.pauseTrip();
  const resumeTrip = () => {
    if (tripId) {
      webSocketService.resumeTrip(tripId);
    }
  };
  const endTrip = () => {
    webSocketService.endTrip();
    setTripId(null);
  };

  return (
    <SocketContext.Provider value={{ socketStatus, tripId, logs, connectSocket, disconnectSocket, startTrip, pauseTrip, resumeTrip, endTrip }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
