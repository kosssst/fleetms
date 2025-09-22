
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import * as Keychain from 'react-native-keychain';
import api from '../config/api';
import { User } from '../types/user.types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    await Keychain.resetGenericPassword();
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user', error);
      await logout();
    }
  }, [logout]);

  useEffect(() => {
    const loadToken = async () => {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        setToken(credentials.password);
        await fetchUser();
      }
      setLoading(false);
    };
    loadToken();
  }, [fetchUser]);

  const login = async (newToken: string) => {
    setToken(newToken);
    await Keychain.setGenericPassword('token', newToken);
    await fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
