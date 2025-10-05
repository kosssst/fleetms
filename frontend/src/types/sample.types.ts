export interface Sample {
  id: string;
  tripId: string;
  timestamp: string;
  gps: {
    latitude: number;
    longitude: number;
    altitude: number;
  };
  obd: {
    vehicleSpeed: number;
    engineRpm: number;
    acceleratorPosition: number;
    engineCoolantTemp: number;
    intakeAirTemp: number;
    fuelConsumptionRate: number;
  };
}
