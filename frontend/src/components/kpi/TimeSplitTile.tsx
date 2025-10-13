"use client";

import { DonutTile } from "./DonutTile";

const toHours = (sec: number) => (sec ?? 0) / 3600;

export function TimeSplitTile({ idleDurationSec, motionDurationSec }: { idleDurationSec: number; motionDurationSec: number; }) {
  const idleH = toHours(idleDurationSec);
  const motionH = toHours(motionDurationSec);
  const totalH = idleH + motionH;

  return (
    <DonutTile
      totalLabel="Engine on time"
      totalValue={totalH}
      unit="h"
      decimals={1}
      slices={[
        { label: "Idle time", value: idleH },
        { label: "Driving time", value: motionH },
      ]}
    />
  );
}
