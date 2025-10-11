'use client';

import {Tabs, rem, Paper} from '@mantine/core';
import { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  IconInfoCircle, IconUsers, IconTruck, IconRoute,
} from '@tabler/icons-react';
import { CompanyGuard } from '@/components/guards/CompanyGuard';

const tabs = [
  { label: 'Company Info', href: '/company',          icon: IconInfoCircle },
  { label: 'Users',        href: '/company/users',    icon: IconUsers },
  { label: 'Vehicles',     href: '/company/vehicles', icon: IconTruck },
  { label: 'Trips',        href: '/company/trips',    icon: IconRoute },
];

export default function CompanyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const current = useMemo(() => {
    const norm = (s: string) => s.replace(/\/+$/, ''); // прибираємо кінцевий слеш
    const p = norm(pathname ?? '');
    // шукаємо НАЙДОВШИЙ префікс, що підходить
    const match = [...tabs]
      .sort((a, b) => b.href.length - a.href.length)
      .find(({ href }) => {
        const h = norm(href);
        return p === h || p.startsWith(h + '/');
      });
    return match?.href ?? tabs[0].href;
  }, [pathname]);

  return (
    <CompanyGuard>
      <Tabs value={current} onChange={(v) => v && router.push(v)}>
        <Tabs.List>
          {tabs.map(({ label, href, icon: Icon }) => (
            <Tabs.Tab
              key={href}
              value={href}
              leftSection={<Icon style={{ width: rem(16), height: rem(16) }} />}
            >
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      <Paper withBorder radius="md" p="md" mt="md">
        {children}
      </Paper>
    </CompanyGuard>
  );
}
