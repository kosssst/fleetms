"use client";

import { useState, useEffect } from 'react';
import { User } from '@/types/user.types';
import { getMe } from '@/services/auth.service';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const userData = localStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
        setLoading(false);
      } else {
        try {
          const data = await getMe();
          setUser(data);
          localStorage.setItem('user', JSON.stringify(data));
        } catch {
          // User is not authenticated
        } finally {
          setLoading(false);
        }
      }
    }

    loadUser();
  }, []);

  return { user, loading };
}
