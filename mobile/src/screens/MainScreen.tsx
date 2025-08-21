
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, PaperProvider, Card, Title, Paragraph } from 'react-native-paper';
import { theme } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';



const MainScreen = () => {
  const { user, logout } = useAuth();

  return (
    <PaperProvider theme={theme}>
      <View style={styles.container}>
        <Card>
          <Card.Content>
            <Title>Welcome, {user?.firstName}!</Title>
            <Paragraph>Email: {user?.email}</Paragraph>
            <Paragraph>Role: {user?.role}</Paragraph>
          </Card.Content>
        </Card>
        <Button mode="contained" onPress={logout} style={styles.button}>
          Logout
        </Button>
      </View>
    </PaperProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  button: {
    marginTop: 16,
  },
});

export default MainScreen;
