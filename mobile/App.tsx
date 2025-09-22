import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import { SocketProvider } from './src/contexts/SocketContext';
import { BluetoothProvider } from './src/contexts/BluetoothContext';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => {
  return (
    <PaperProvider>
      <AuthProvider>
        <SocketProvider>
          <BluetoothProvider>
            <AppNavigator />
          </BluetoothProvider>
        </SocketProvider>
      </AuthProvider>
    </PaperProvider>
  );
};

export default App;