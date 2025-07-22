"use client";

import { useState } from 'react';
import { Container, Group, Text, Image } from '@mantine/core';
import classes from './Header.module.scss';
import { PROJECT_NAME } from '@/constants/appConfig';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

const links = [
  { link: '/about', label: 'Features' },
  { link: '/pricing', label: 'Pricing' },
  { link: '/learn', label: 'Learn' },
  { link: '/community', label: 'Community' },
];

export function Header() {
  const [active, setActive] = useState(links[0].link);
  const { user } = useAuth();

  const items = links.map((link) => (
    <a
      key={link.label}
      href={link.link}
      className={classes.link}
      data-active={active === link.link || undefined}
      onClick={(event) => {
        event.preventDefault();
        setActive(link.link);
      }}
    >
      {link.label}
    </a>
  ));

  return (
    <header className={classes.header}>
      <Container fluid px="md" className={classes.inner}>
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Group>
            <Image src="/logo.svg" alt="Project Logo" h={30} />
            <Text fw={700} size="30">{PROJECT_NAME}</Text>
          </Group>
        </Link>

        <Group gap={5} visibleFrom="xs" className={classes.nav}>
          {items}
        </Group>

        <Link href="/profile" className={classes.link}>
          <Group visibleFrom="xs">
            <Text>
              {user.firstName} {user.lastName}
            </Text>
            <Image src="/profile-icon-dark-theme.svg" alt="Profile" h={30} />
          </Group>
        </Link>

      </Container>
    </header>
  );
}
