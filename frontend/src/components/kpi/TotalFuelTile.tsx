"use client";
import { Card, Divider, Group, Skeleton, Text, Title } from "@mantine/core";
import TopList from "./TopList";
import { FuelTopItem } from "@/types/dashboard.types";

const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export function TotalFuelTile({ liters, top, max = 3, loadingTop = false, }: { liters: number | null; top?: FuelTopItem[] | null; max?: number; loadingTop?: boolean; }) {
  const val = liters == null || Number.isNaN(liters) ? "—" : nf2.format(liters);

  return (
    <Card withBorder radius="md" p="md">
      <Text c="dimmed" size="sm">Fuel used (period)</Text>
      <Group gap="xs" mt={6}>
        <Title order={2}>{val}</Title>
        <Text c="dimmed">L</Text>
      </Group>

      <Text size="sm" mt="md">Top vehicles</Text>

      {(top !== undefined || loadingTop) && <Divider my="xs" />}

      {loadingTop && top === undefined ? (
        <>
          <Skeleton height={18} mt="xs" />
          <Skeleton height={18} />
          <Skeleton height={18} />
        </>
      ) : (
        <TopList
          items={top}
          formatValue={(v) => nf2.format(v.fuelUsedL)}
          unit="L"
          max={max}
        />
      )}
    </Card>
  );
}