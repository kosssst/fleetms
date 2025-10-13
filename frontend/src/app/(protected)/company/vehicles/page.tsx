import {VehiclesTable} from "@/components/tables/VehiclesTable";
import {Paper} from "@mantine/core";

export default function VehiclesPage() {
  return (
    <Paper withBorder p="md" mt="md" radius="md">
      <VehiclesTable />
    </Paper>
  )
}