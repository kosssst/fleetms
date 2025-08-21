
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '../styles/theme';



export const SplashScreen = () => {
  return (
    <PaperProvider theme={theme}>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
