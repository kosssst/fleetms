import React from 'react';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import { SocketProvider } from './src/contexts/SocketContext';
import AppNavigator from './src/navigation/AppNavigator';

const App = () => {
  return (
    <PaperProvider>
      <AuthProvider>
        <SocketProvider>
          <AppNavigator />
        </SocketProvider>
      </AuthProvider>
    </PaperProvider>
  );
};

export default App;