import React, { useEffect } from 'react';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SocketProvider, useSocket } from './src/contexts/SocketContext';
import { BluetoothProvider } from './src/contexts/BluetoothContext';
import AppNavigator from './src/navigation/AppNavigator';
import './src/polyfills/nativeEventEmitterShim';

const AppContent = () => {
  const { user, token } = useAuth();
  const { authenticate } = useSocket();

  useEffect(() => {
    if (user && token) {
      authenticate(token);
    }
  }, [user, token, authenticate]);

  return <AppNavigator />;
};

const App = () => {
  return (
    <PaperProvider>
      <AuthProvider>
        <SocketProvider>
          <BluetoothProvider>
            <AppContent />
          </BluetoothProvider>
        </SocketProvider>
      </AuthProvider>
    </PaperProvider>
  );
};

export default App;