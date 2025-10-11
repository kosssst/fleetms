import { Card, Group, Text, Title } from "@mantine/core";

export function TotalDistanceTile({ km }: { km: number | null }) {
  const val = km == null || Number.isNaN(km) ? "—" : (Math.round(km * 10) / 10).toFixed(1);
  return (
    <Card withBorder radius="md" p="md">
      <Text c="dimmed" size="sm">Total distance (period)</Text>
      <Group gap="xs" mt={6}>
        <Title order={2}>{val}</Title>
        <Text c="dimmed">km</Text>
      </Group>
    </Card>
  );
}
