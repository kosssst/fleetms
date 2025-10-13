"use client";
import { Card, Divider, Group, Skeleton, Text, Title } from "@mantine/core";
import TopList from "./TopList";
import { DistanceTopItem } from "@/types/dashboard.types";

const nf1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function TotalDistanceTile({ km, top, max = 3, loadingTop = false, }: { km: number | null; top?: DistanceTopItem[] | null; max?: number; loadingTop?: boolean; }) {
  const val = km == null || Number.isNaN(km) ? "—" : nf1.format(km);

  return (
    <Card withBorder radius="md" p="md">
      <Text c="dimmed" size="sm">Total distance</Text>
      <Group gap="xs" mt={6}>
        <Title order={2}>{val}</Title>
        <Text c="dimmed">km</Text>
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
          formatValue={(v) => nf1.format(v.distanceKm)}
          unit="km"
          max={max}
        />
      )}
    </Card>
  );
}