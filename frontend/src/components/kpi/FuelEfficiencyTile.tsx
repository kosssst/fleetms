import { FuelPer100KmTopItem } from "@/types/dashboard.types";
import {
  Card,
  Divider,
  Skeleton,
  Text,
  Group,
  Stack,
  ThemeIcon,
  Tooltip,
} from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

type Props = {
  top?: FuelPer100KmTopItem[] | null;
  loadingTop?: boolean;
  needsInspection: string[];
  max?: number;
  emptyLabel?: string;
};

export function FuelEfficiency({
                                 top,
                                 loadingTop,
                                 needsInspection,
                                 max = 3,
                                 emptyLabel = "No data",
                               }: Props) {
  const data = (top ?? []).slice(0, max);
  const flaggedSet = new Set(needsInspection || []);
  const otherFlagged =
    (needsInspection || []).filter(
      (num) => !data.some((t) => t.vehicleNumber === num)
    ) ?? [];

  return (
    <Card withBorder radius="md" p="md">
      <Text size="sm" c="dimmed">
        Most Inefficient Vehicles
      </Text>

      {(top !== undefined || loadingTop) && <Divider my="xs" />}

      {loadingTop && top === undefined ? (
        <>
          <Skeleton height={18} mt="xs" />
          <Skeleton height={18} />
          <Skeleton height={18} />
        </>
      ) : (
        <Stack gap="xs">
          {/* TOP-список у стилі TopList */}
          {data.length > 0 ? (
            data.map((item, idx) => {
              const flagged = flaggedSet.has(item.vehicleNumber);
              const value = item.fuelPer100Km.toFixed(2);

              return (
                <Group
                  key={`${item.vehicleNumber}-${idx}`}
                  justify="space-between"
                  wrap="nowrap"
                >
                  {/* Ліва частина: нумерація + номер авто */}
                  <Group gap="xs" wrap="nowrap">
                    <Text fw={600} size="sm" w={22} ta="right">
                      {idx + 1}.
                    </Text>
                    <Text
                      size="sm"
                      lineClamp={1}
                      title={item.vehicleNumber}
                    >
                      {item.vehicleNumber || "(unknown)"}
                    </Text>
                  </Group>

                  {/* Права частина: (іконка якщо треба) + значення + юніт */}
                  <Group gap={6} wrap="nowrap">
                    {flagged && (
                      <Tooltip label="Needs inspection" withArrow>
                        <ThemeIcon
                          size={18}
                          radius="sm"
                          color="yellow"
                          variant="light"
                          style={{ minWidth: 18 }}
                          title="Needs inspection"
                        >
                          <IconAlertTriangle size={14} />
                        </ThemeIcon>
                      </Tooltip>
                    )}
                    <Text size="sm" fw={500}>
                      {value}
                    </Text>
                    <Text c="dimmed" size="sm">
                      L/100km
                    </Text>
                  </Group>
                </Group>
              );
            })
          ) : (
            <Text c="dimmed" size="sm">
              {emptyLabel}
            </Text>
          )}

          {/* Інші авто, що потребують огляду, але не у TOP */}
          {otherFlagged.length > 0 && (
            <>
              <Divider my="xs" />
              <Text size="sm" c="dimmed">
                Other vehicles which need inspection:
              </Text>

              <Stack gap={6}>
                {otherFlagged.map((num, i) => (
                  <Group key={`${num}-${i}`} justify="space-between" wrap="nowrap">
                    <Group gap="xs" wrap="nowrap">
                      {/* Порожня колонка під нумерацію для вирівнювання */}
                      <Text size="sm" w={22} ta="right" />
                      <Text size="sm" lineClamp={1} title={num}>
                        {num}
                      </Text>
                    </Group>

                    {/* Праворуч іконка + “—”, щоб іконка теж була біля "значення" */}
                    <Group gap={6} wrap="nowrap">
                      <ThemeIcon
                        size={18}
                        radius="sm"
                        color="yellow"
                        variant="light"
                        style={{ minWidth: 18 }}
                        title="Needs inspection"
                      >
                        <IconAlertTriangle size={14} />
                      </ThemeIcon>
                      <Text size="sm" fw={500}>
                        —
                      </Text>
                    </Group>
                  </Group>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      )}
    </Card>
  );
}

export default FuelEfficiency;
