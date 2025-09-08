import { API_URL } from '../config/api';

let socket: WebSocket;

export const initSocket = (token: string, onAuthFailure: () => void) => {
  if (socket) {
    socket.close();
  }

  const socketUrl = API_URL.replace('http', 'ws');
  socket = new WebSocket(`${socketUrl}?token=${token}`);

  socket.onopen = () => {
    console.log('Socket connected');
  };

  socket.onclose = (event) => {
    console.log('Socket disconnected:', event.reason);
    if (event.code === 1008) {
      onAuthFailure();
    }
  };

  socket.onerror = (error) => {
    console.error('Socket error:', error);
  };

  socket.onmessage = (event) => {
    if (event.data === 'authenticated') {
      console.log('Socket authenticated');
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