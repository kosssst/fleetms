import { useState, useEffect } from 'react';
import { getUsersByCompanyId } from '@/services/user.service';
import { User } from '@/types/user.types';

export function useCompanyUsers(companyId: string | null) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    async function loadUsers() {
      if (!companyId) {
        setLoading(false);
        return;
      }

      try {
        const usersData = await getUsersByCompanyId(companyId);
        setUsers(usersData);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    loadUsers();
  }, [companyId]);

  return { users, loading, error };
}
