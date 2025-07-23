"use client";

import { useState } from 'react';
import {Container, Group, Image, Title} from '@mantine/core';
import classes from './Header.module.scss';
import { PROJECT_NAME } from '@/constants/appConfig';
import Link from 'next/link';
import {UserButton} from "@/components/buttons/UserButton";

const links = [
  { link: '/about', label: 'Features' },
  { link: '/pricing', label: 'Pricing' },
  { link: '/learn', label: 'Learn' },
  { link: '/community', label: 'Community' },
];

export function Header() {
  const [active, setActive] = useState(links[0].link);

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
          <Group justify="center">
            <Image src="/logo.svg" alt="Project Logo" h={30} w={30}/>
            <Title>{PROJECT_NAME}</Title>
          </Group>
        </Link>

        <Group gap={5} visibleFrom="xs" className={classes.nav}>
          {items}
        </Group>
        <div>
          <Link href="/profile" className={classes.link}>
            <UserButton />
          </Link>
        </div>
      </Container>
    </header>
  );
}
