import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
} from 'react';
import { webSocketService } from '../services/WebSocketService';

interface SocketContextData {
  socketStatus: 'connected' | 'disconnected';
  startTrip: () => void;
  pauseTrip: () => void;
  resumeTrip: () => void;
  endTrip: () => void;
}

const SocketContext = createContext<SocketContextData>({} as SocketContextData);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  useEffect(() => {
    webSocketService.connect();

    return () => {
      webSocketService.disconnect();
    };
  }, []);

  const startTrip = () => {
    webSocketService.startTrip();
  };

  const pauseTrip = () => {
    webSocketService.pauseTrip();
  };

  const resumeTrip = () => {
    webSocketService.resumeTrip();
  };

  const endTrip = () => {
    webSocketService.endTrip();
  };

  return (
    <SocketContext.Provider
      value={{
        socketStatus: 'connected',
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