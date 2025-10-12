export type Summary = {
  distanceKm: {
    total: number;
    top: Array<{ vehicleNumber: string; distanceKm: number }>;
  }
  fuelUsedL: {
    total: number;
    top: Array<{ vehicleNumber: string; fuelUsedL: number }>;
  }
  fuelUsedInIdleL: number;
  fuelUsedInMotionL: number;
  idleDurationSec: number;
  motionDurationSec: number;
  topFuelPer100Km: Array<{ vehicleNumber: string; fuelPer100Km: number }>;
  fuelUsedPerDay: Array<{ date: string; fuelUsedL: number }>;
};

export type DistanceTopItem = {
  vehicleNumber: string;
  distanceKm: number;
};

export type FuelTopItem = {
  vehicleNumber: string;
  fuelUsedL: number;
};

export type FuelPer100KmTopItem = {
  vehicleNumber: string;
  fuelPer100Km: number;
};