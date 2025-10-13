"use client";
import {Group, Stack, Text } from "@mantine/core";

type BaseItem = { vehicleNumber: string };
type TopListProps<T extends BaseItem> = {
  items?: T[] | null;
  formatValue: (item: T) => string;
  unit: string;
  max?: number;
  emptyLabel?: string;
};

export default function TopList<T extends BaseItem>({ items, formatValue, unit, max = 5, emptyLabel = "" }: TopListProps<T>) {
  if (!items) return null;
  const data = items.slice(0, max);
  if (data.length === 0) return <Text c="dimmed" size="sm">{emptyLabel}</Text>;

  return (
    <Stack gap="xs">
      {data.map((it, idx) => (
        <Group key={idx} justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            <Text fw={600} size="sm" w={22} ta="right">{idx + 1}.</Text>
            <Text size="sm" lineClamp={1} title={it.vehicleNumber}>
              {it.vehicleNumber || "(unknown)"}
            </Text>
          </Group>
          <Group gap={4} wrap="nowrap">
            <Text size="sm" fw={500}>{formatValue(it)}</Text>
            <Text c="dimmed" size="sm">{unit}</Text>
          </Group>
        </Group>
      ))}
    </Stack>
  );
}