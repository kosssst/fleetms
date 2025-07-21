import { useState, useEffect } from 'react';
import { getCompany } from '@/services/company.service';
import { Company } from '@/types/company.types';

export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    async function fetchCompany() {
      try {
        const companyData = await getCompany();
        setCompany(companyData);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }

    fetchCompany();
  }, []);

  return { company, loading, error, setCompany };
}