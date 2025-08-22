import React from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { AuthProvider } from './src/contexts/AuthContext';
import { BluetoothProvider } from './src/contexts/BluetoothContext';
import AppNavigator from './src/navigation/AppNavigator';
import { darkTheme, lightTheme } from './src/styles/theme';

export default function App() {
  const colorScheme = useColorScheme();
  const theme = colorScheme === 'dark' ? darkTheme : lightTheme;

  return (
    <PaperProvider theme={theme}>
      <AuthProvider>
        <BluetoothProvider>
          <AppNavigator />
        </BluetoothProvider>
      </AuthProvider>
    </PaperProvider>
  );
}