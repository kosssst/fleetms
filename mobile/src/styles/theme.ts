import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#228be6',      // mantine blue[7]
    accent: '#1c7ed6',        // mantine blue[8]
    background: '#f8f9fa',    // mantine gray[0]
    surface: '#ffffff',       // white
    text: '#212529',          // mantine gray[9]
    placeholder: '#868e96',   // mantine gray[6]
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#8c8fa3',       // mantine dark[2]
    accent: '#4d4f66',        // mantine dark[4]
    background: '#1d1e30',    // mantine dark[7]
    surface: '#2b2c3d',       // mantine dark[6]
    text: '#d5d7e0',          // mantine dark[0]
    placeholder: '#666980',   // mantine dark[3]
  },
};