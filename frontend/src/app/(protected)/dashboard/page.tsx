"use client";

import { useEffect, useMemo, useState } from "react";
import { Container, Group, SimpleGrid, Title, Text, Paper, Loader } from "@mantine/core";
import { DatePickerInput, type DatesRangeValue } from '@mantine/dates';
import dayjs from "dayjs";
import type { Summary } from "@/types/dashboard.types";
import { TotalDistanceTile } from "@/components/kpi/TotalDistanceTile";
import { TotalFuelTile } from "@/components/kpi/TotalFuelTile";
import {getSummary} from "@/services/dashboard.service";


export default function DashboardPage() {
  // початково — останні 7 днів
  const [range, setRange] = useState<DatesRangeValue>(() => {
    const to = new Date();
    const from = dayjs(to).subtract(6, 'day').toDate();
    return [from, to]; // [Date|null, Date|null]
  });

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { fromISO, toISO_ } = useMemo(() => {
    const [from, to] = range;
    const fromISO = from ? dayjs(from).format('DD-MM-YYYY') : null;
    const toISO_  = to   ? dayjs(to).format('DD-MM-YYYY')   : null;
    if (!from || !to) return { fromISO: null as string | null, toISO_: null as string | null };
    return { fromISO, toISO_ };
  }, [range]);

  useEffect(() => {
    if (!fromISO || !toISO_) return;

    setLoading(true);
    setError(null);

    getSummary(fromISO, toISO_)
      .then((data) => {
        setSummary(data);
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to load');
        setSummary({ distanceKm: { total: 0.0, top: [] }, fuelUsedL: { total: 0.0, top: [] } });
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fromISO, toISO_]);

  return (
    <Container size="lg" py="lg">
      <Group justify="space-between" mb="md" align="center">
        <Title order={2}>Dashboard</Title>
        <DatePickerInput
          type="range"
          label="Period"
          value={range}
          onChange={setRange}
          maxDate={new Date()}
          allowSingleDateInRange
          valueFormat="DD-MM-YYYY"
        />
      </Group>

      {loading && (
        <Paper withBorder radius="md" p="xl" mt="md">
          <Group justify="center" gap="sm"><Loader size="sm" /><Text>Loading…</Text></Group>
        </Paper>
      )}

      {!loading && (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <TotalDistanceTile km={summary?.distanceKm.total ?? null} top={summary?.distanceKm.top ?? null} />
          <TotalFuelTile liters={summary?.fuelUsedL.total ?? null} top={summary?.fuelUsedL.top ?? null}/>
        </SimpleGrid>
      )}

      {error && <Text c="dimmed" size="sm" mt="sm">Note: {error}</Text>}
    </Container>
  );
}