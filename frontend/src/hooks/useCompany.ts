import { useEffect, useState } from 'react';
import { getCompany } from '@/services/company.service';
import { Company } from '@/types/company.types';

// модульний кеш/обіцянка, спільні для всіх викликів хуку
let cachedCompany: Company | null = null;
let inflight: Promise<Company | null> | null = null;

export function useCompany() {
  // синхронно читаємо з cache/localStorage для уникнення флікера
  const initial = (() => {
    if (typeof window === 'undefined') return null;
    if (cachedCompany) return cachedCompany;
    const raw = localStorage.getItem('company');
    if (!raw) return null;
    try { return JSON.parse(raw) as Company; } catch { return null; }
  })();

  const [company, setCompany] = useState<Company | null>(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let active = true;
    if (company) return; // уже є — нічого не робимо

    (async () => {
      try {
        setLoading(true);
        inflight ||= getCompany().catch((e) => { throw e; });
        const data = await inflight;
        if (!active) return;
        cachedCompany = data;
        if (data) localStorage.setItem('company', JSON.stringify(data));
        setCompany(data);
      } catch (e) {
        if (!active) return;
        setError(e);
      } finally {
        if (active) setLoading(false);
        inflight = null;
      }
    })();

    // синхронізація між вкладками/вікнами
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'company') {
        const v = e.newValue ? (JSON.parse(e.newValue) as Company) : null;
        cachedCompany = v;
        setCompany(v);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      active = false;
      window.removeEventListener('storage', onStorage);
    };
  }, [company]);

  const setCompanyAndCache = (c: Company | null) => {
    cachedCompany = c;
    setCompany(c);
    if (c) localStorage.setItem('company', JSON.stringify(c));
    else localStorage.removeItem('company');
  };

  return { company, loading, error, setCompany: setCompanyAndCache };
}