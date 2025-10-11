import { Card, Group, Text, Title } from "@mantine/core";

export function TotalFuelTile({ liters }: { liters: number | null }) {
  const val = liters == null || Number.isNaN(liters) ? "—" : (Math.round(liters * 100) / 100).toFixed(2);
  return (
    <Card withBorder radius="md" p="md">
      <Text c="dimmed" size="sm">Fuel used (period)</Text>
      <Group gap="xs" mt={6}>
        <Title order={2}>{val}</Title>
        <Text c="dimmed">L</Text>
      </Group>
    </Card>
  );
}