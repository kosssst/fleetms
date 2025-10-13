import {TripsTable} from "@/components/tables/TripsTable";
import {Paper} from "@mantine/core";

export default function TripsPage() {
  return (
    <Paper withBorder p="md" mt="md" radius="md">
      <TripsTable />
    </Paper>
  )
}