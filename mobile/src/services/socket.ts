import config from '../config/config';

let socket: WebSocket;

export const initSocket = (
  token: string,
  onAuthFailure: () => void,
  addLog: (message: string) => void,
  setSocketStatus: (status: 'disconnected' | 'connected' | 'error') => void,
) => {
  if (socket) {
    socket.close();
  }

  const socketUrl = config.WEBSOCKET_URL;
  socket = new WebSocket(`${socketUrl}?token=${token}`);

  socket.onopen = () => {
    addLog('Socket connected');
    setSocketStatus('connected');
  };

  socket.onclose = (event) => {
    addLog(`Socket disconnected: ${event.reason}`);
    setSocketStatus('disconnected');
    if (event.code === 1008) {
      onAuthFailure();
    }
  };

  socket.onerror = (error) => {
    addLog(`Socket error: ${(error as any).message}`);
    setSocketStatus('error');
  };

  socket.onmessage = (event) => {
    if (event.data === 'authenticated') {
      addLog('Socket authenticated');
    } else {
      addLog(`Socket message: ${event.data}`);
    }
  };

  return socket;
};

export const getSocket = () => {
  if (!socket) {
    throw new Error('Socket not initialized');
  }
  return socket;
};