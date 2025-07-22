"use client";

import { useState } from 'react';
import {Burger, Container, Group, Button, Text, Image} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import classes from './Header.module.scss';
import { PROJECT_NAME } from '@/constants/appConfig';
import { useAuth } from '@/hooks/useAuth';
import Cookies from 'js-cookie';

const links = [
  { link: '/about', label: 'Features' },
  { link: '/pricing', label: 'Pricing' },
  { link: '/learn', label: 'Learn' },
  { link: '/community', label: 'Community' },
];

export function Header() {
  const [opened, { toggle }] = useDisclosure(false);
  const [active, setActive] = useState(links[0].link);
  const { user } = useAuth();

  const handleLogout = () => {
    Cookies.remove('token');
    localStorage.clear();
    window.location.href = '/';
  };

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
        <Group>
          <Image src="/logo.svg" alt="Project Logo" h={30} />
          <Text fw={700} size="30">{PROJECT_NAME}</Text>
        </Group>

        <Group gap={5} visibleFrom="xs" className={classes.nav}>
          {items}
        </Group>

        <Group>
          {user && (
            <Group visibleFrom="xs">
              <Text>
                {user.firstName} {user.lastName}
              </Text>
              <Button onClick={handleLogout}>Logout</Button>
            </Group>
          )}
          <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />
        </Group>
      </Container>
    </header>
  );
}
