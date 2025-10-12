import {FuelPer100KmTopItem} from "@/types/dashboard.types";
import {Card, Divider, Skeleton, Text} from "@mantine/core";
import TopList from "@/components/kpi/TopList";

export function FuelEfficiency ({ top, loadingTop } : {top?: FuelPer100KmTopItem[] | null; loadingTop?: boolean;  }) {
  return (
    <Card withBorder radius="md" p="md">
      <Text size="sm" c="dimmed">Most Inefficient Vehicles</Text>

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
          formatValue={(v) => v.fuelPer100Km.toFixed(2)}
          unit={"L/100km"}
          max={3}
        />
      )}
    </Card>
  )
}