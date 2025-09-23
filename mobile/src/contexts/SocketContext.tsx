import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
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
  const { token } = useAuth();
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [tripId, setTripId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [`[${timestamp}] ${message}`, ...prevLogs.slice(0, 100)]);
  }, []);

  useEffect(() => {
    // This effect now only registers the callbacks
    webSocketService.onStatusChange = setSocketStatus;
    webSocketService.onTripIdReceived = setTripId;
    webSocketService.onLog = addLog;
  }, [addLog]);

  const connectSocket = useCallback(() => {
    if (token) {
      webSocketService.connect(token);
    } else {
      addLog("Error: Cannot connect. No auth token available.");
    }
  }, [token, addLog]);

  const disconnectSocket = useCallback(() => {
    webSocketService.disconnect();
  }, []);


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
