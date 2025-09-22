import axios from 'axios';
import * as Keychain from 'react-native-keychain';

export const API_URL = 'http://192.168.31.248:8000'; // Make sure this IP is accessible from your mobile device

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to include the token in headers
api.interceptors.request.use(
  async (config) => {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        config.headers.Authorization = `Bearer ${credentials.password}`;
      }
    } catch (error) {
      console.log("Keychain couldn't be accessed!", error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;