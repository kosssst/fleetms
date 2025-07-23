"use client";

import { IconChevronRight } from '@tabler/icons-react';
import { Avatar, Group, Text, UnstyledButton } from '@mantine/core';
import classes from './UserButton.module.scss';
import { useAuth } from "@/context/AuthContext";

export function UserButton() {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  return (
    <UnstyledButton className={classes.user}>
      <Group>
        <Avatar name={`${user.firstName} ${user.lastName}`} color="initials" />

        <div style={{ flex: 1 }}>
          <Text size="sm" fw={500}>
            {user.firstName} {user.lastName}
          </Text>

          <Text c="dimmed" size="xs">
            {user.email}
          </Text>
        </div>

        <IconChevronRight size={14} stroke={1.5} />
      </Group>
    </UnstyledButton>
  );
}
