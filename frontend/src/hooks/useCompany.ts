import { useState, useEffect } from 'react';
import { getCompany } from '@/services/company.service';
import { Company } from '@/types/company.types';

export function useCompany() {
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    async function loadCompany() {
      const companyData = localStorage.getItem('company');
      if (companyData) {
        setCompany(JSON.parse(companyData));
        setLoading(false);
      } else {
        try {
          const companyData = await getCompany();
          setCompany(companyData);
          localStorage.setItem('company', JSON.stringify(companyData));
        } catch (err) {
          setError(err);
        } finally {
          setLoading(false);
        }
      }
    }

    loadCompany();
  }, []);

  const setCompanyAndCache = (company: Company | null) => {
    setCompany(company);
    if (company) {
      localStorage.setItem('company', JSON.stringify(company));
    } else {
      localStorage.removeItem('company');
    }
  };

  return { company, loading, error, setCompany: setCompanyAndCache };
}
