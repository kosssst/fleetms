"use client";

import { Card, Text, Skeleton, useMantineTheme } from "@mantine/core";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export type FuelPerDayPoint = { date: string; fuelUsedL: number };

export function FuelPerDayTile({ data, height = 220, color, loading = false, decimals = 2, title = "Fuel used per day", }: { data?: FuelPerDayPoint[] | null; height?: number; color?: string; loading?: boolean; decimals?: number; title?: string;}) {
  const theme = useMantineTheme();

  const barColor = color ?? theme.colors.blue?.[6] ?? "#228be6";

  return (
    <Card withBorder radius="md" p="md">
      <Text c="dimmed" size="sm">{title}</Text>

      {loading ? (
        <>
          <Skeleton height={height} />
        </>
      ) : data && data.length > 0 ? (
        <div style={{ width: "100%", height, marginTop: 16 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d: unknown) =>
                  typeof d === "string" ? d.slice(0, 5) : String(d ?? "")
                } // показати "DD-MM"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                allowDecimals
                tickFormatter={(v: number) =>
                  new Intl.NumberFormat(undefined, { maximumFractionDigits: decimals }).format(v)
                }
              />
              <Bar
                dataKey="fuelUsedL"
                fill={barColor}
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <Text c="dimmed" size="sm">No data</Text>
      )}
    </Card>
  );
}
