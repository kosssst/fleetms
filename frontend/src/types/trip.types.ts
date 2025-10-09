import { User } from './user.types';
import { Vehicle } from './vehicle.types';

export interface Trip {
  id: string;
  driverId: User;
  vehicleId: Vehicle;
  companyId: string;
  status: 'ongoing' | 'paused' | 'completed';
  startTime: string;
  endTime?: string;
  summary?: {
    durationSec: number;
    distanceKm: number;
    avgSpeedKph: number;
    maxSpeedKph: number;
    avgRpm: number;
    maxRpm: number;
    fuelUsedL: number;
    avgFuelRateLph: number;
    route: {
      latitude: number;
      longitude: number;
    }[];
  };
  predictionSummary?: {
    fuelUsedL: number;
    avgFuelRateLph: number;
    MAE: number;
    RMSE: number;
    R2: number;
  };
  numSamples?: number;
  role?: string;
}
