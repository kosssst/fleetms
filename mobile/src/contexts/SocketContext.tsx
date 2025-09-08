import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type SocketStatus = 'disconnected' | 'connected' | 'error';

interface SocketContextData {
  socketStatus: SocketStatus;
  logs: string[];
  addLog: (message: string) => void;
  setSocketStatus: (status: SocketStatus) => void;
}

const SocketContext = createContext<SocketContextData>({} as SocketContextData);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socketStatus, setSocketStatus] = useState<SocketStatus>('disconnected');
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prevLogs => [`[${timestamp}] ${message}`, ...prevLogs.slice(0, 100)]);
  }, []);

  return (
    <SocketContext.Provider value={{ socketStatus, logs, addLog, setSocketStatus }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  return useContext(SocketContext);
};
