"use client";

import {Button, Container, Group, Image, Title} from '@mantine/core';
import { PROJECT_NAME } from '@/constants/appConfig';
import Link from 'next/link';
import {UserButton} from "@/components/buttons/UserButton";
import {ThemeSwitcher} from "@/components/buttons/ThemeSwitcher";
import {useAuth} from "@/context/AuthContext";
import { navLinks } from '@/constants/navLinks';
import { usePathname } from 'next/navigation';

export function Header() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  const items = navLinks
    .filter(link => !link.authRequired || (link.authRequired && user))
    .map((link) => (
    <Link
      key={link.label}
      href={link.href}
      className="nav-link" // A generic class for styling links
      data-active={pathname === link.href || undefined}
    >
      {link.label}
    </Link>
  ));

  return (
    <header className="header">
      <Container fluid px="md" className="header-inner">
        <Link href="/" style={{ textDecoration: 'none', color: 'inherit' }}>
          <Group justify="center" className="logo">
            <Image src="/logo.svg" alt="Project Logo" h={30} w={30}/>
            <Title>{PROJECT_NAME}</Title>
          </Group>
        </Link>

        <Group gap={5} visibleFrom="xs" className="nav">
          {items}
        </Group>
        <Group>
          <ThemeSwitcher />
          {!loading &&
            (user ? (
              <Link href="/profile" className="profileLink">
                <UserButton />
              </Link>
            ) : (
              <Button component={Link} href="/auth" className="loginButton">
                Log in
              </Button>
            ))}
        </Group>
      </Container>
    </header>
  );
}
