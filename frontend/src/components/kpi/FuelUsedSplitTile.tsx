"use client";

import { DonutTile } from "./DonutTile";

export function FuelUsedSplitTile({ fuelUsedTotalL, fuelUsedInIdleL, fuelUsedInMotionL, }: { fuelUsedTotalL: number | null; fuelUsedInIdleL: number; fuelUsedInMotionL: number; }) {
  return (
    <DonutTile
      totalLabel="Fuel used"
      totalValue={fuelUsedTotalL}
      unit="L"
      decimals={2}
      slices={[
        { label: "Fuel used in idle", value: fuelUsedInIdleL },
        { label: "Fuel used driving", value: fuelUsedInMotionL },
      ]}
    />
  );
}