import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Title, Paragraph, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import ConnectionStatus from '../components/ConnectionStatus';

const MainScreen = () => {
  const { user, logout } = useAuth();
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ConnectionStatus />
      <Card style={{ backgroundColor: theme.colors.surface }}>
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