import {UsersTable} from "@/components/tables/UsersTable";
import {Paper} from "@mantine/core";

export default function UsersPage() {
  return (
    <Paper withBorder p="md" mt="md" radius="md">
      <UsersTable/>
    </Paper>
  )
}