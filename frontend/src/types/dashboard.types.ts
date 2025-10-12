export type Summary = {
  distanceKm: {
    total: number;
    top: Array<{ vehicleNumber: string; distanceKm: number }>;
  }
  fuelUsedL: {
    total: number;
    top: Array<{ vehicleNumber: string; fuelUsedL: number }>;
  }
};

export type DistanceTopItem = {
  vehicleNumber: string;
  distanceKm: number
};

export type FuelTopItem = {
  vehicleNumber: string;
  fuelUsedL: number
};