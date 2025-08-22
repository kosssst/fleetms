import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, useTheme } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { API_URL } from '../config/api';
import Notification from '../components/Notification';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();
  const theme = useTheme();

  const handleLogin = async () => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password, client: 'mobile' });
      await login(response.data.token);
    } catch (err) {
      setError('Invalid email or password');
      console.error(err);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Notification message={error} onDismiss={() => setError(null)} />
      <TextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
        keyboardType="email-address"
        theme={{ colors: { background: theme.colors.surface } }}
      />
      <TextInput
        label="Password"
        value={password}
        onChangeText={setPassword}
        style={styles.input}
        secureTextEntry
        theme={{ colors: { background: theme.colors.surface } }}
      />
      <Button mode="contained" onPress={handleLogin} style={styles.button}>
        Login
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
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});

export default LoginScreen;