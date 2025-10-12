"use client";

import { Card, Group, Stack, Text, Title, Box, Divider, useMantineTheme } from "@mantine/core";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type DonutSlice = {
  label: string;
  value: number;
};

export function DonutTile({ totalLabel, totalValue, unit, slices, decimals = 2, height = 140, }: { totalLabel: string; totalValue: number | null; unit: string; slices: [DonutSlice, DonutSlice]; decimals?: number; height?: number; }) {
  const theme = useMantineTheme();

  const [idle, motion] = slices;
  const sum = (idle.value ?? 0) + (motion.value ?? 0);
  const safeTotal =
    totalValue == null || Number.isNaN(totalValue)
      ? "—"
      : new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(totalValue);

  const cIdle = "#ff5e5e";
  const cMotion = "#77db67";

  const data = sum > 0
    ? [
      { name: idle.label, value: idle.value, color: cIdle },
      { name: motion.label, value: motion.value, color: cMotion },
    ]
    : [{ name: "empty", value: 1, color: theme.colors.gray?.[3] ?? "#ced4da" }];

  return (
    <Card withBorder radius="md" p="md">
      <Text c="dimmed" size="sm">{totalLabel}</Text>
      <Group gap="xs" mt={6}>
        <Title order={2}>{safeTotal}</Title>
        <Text c="dimmed">{unit}</Text>
      </Group>

      <Divider my="sm" />

      <Group align="center" justify="space-between" wrap="nowrap">
        {/* Кільце */}
        <Box style={{ width: 160, height }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius="60%"
                outerRadius="85%"
                dataKey="value"
                stroke="transparent"
                isAnimationActive={false}
                startAngle={90}
                endAngle={-270}
              >
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color as string} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Box>

        {/* Легенда праворуч */}
        <Stack gap="xs" style={{ minWidth: 220 }}>
          <LegendRow
            color={cIdle}
            label={`${idle.label}:`}
            value={idle.value}
            unit={unit}
            decimals={decimals}
          />
          <LegendRow
            color={cMotion}
            label={`${motion.label}:`}
            value={motion.value}
            unit={unit}
            decimals={decimals}
          />
          {/* Проценти як підказка */}
          <Text size="xs" c="dimmed">
            {sum > 0
              ? `Idle ${(idle.value * 100 / sum).toFixed(0)}% • Driving ${(motion.value * 100 / sum).toFixed(0)}%`
              : "No data for ratio"}
          </Text>
        </Stack>
      </Group>
    </Card>
  );
}

function LegendRow({ color, label, value, unit, decimals, }: { color: string; label: string; value: number; unit: string; decimals: number; }) {
  const val = Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(value)
    : "—";

  return (
    <Group justify="space-between" wrap="nowrap">
      <Group gap="xs" wrap="nowrap">
        <Box w={12} h={12} style={{ background: color, borderRadius: 2 }} />
        <Text size="sm">{label}</Text>
      </Group>
      <Group gap={4} wrap="nowrap">
        <Text size="sm" fw={600}>{val}</Text>
        <Text c="dimmed" size="sm">{unit}</Text>
      </Group>
    </Group>
  );
}
