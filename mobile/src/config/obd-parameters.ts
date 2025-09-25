export interface ObdParameter {
  command: string;
  startByte: number;
  numBits: number;
  header: string;
  decoder: string;
}

export const obdParameters: ObdParameter[] = [
  {
    command: '21A0',
    startByte: 15,
    numBits: 16,
    header: 'vehicle_speed',
    decoder: 'vehicleSpeedDecoder',
  },
  {
    command: '21A0',
    startByte: 13,
    numBits: 16,
    header: 'engine_speed',
    decoder: 'engineSpeedDecoder',
  },
  {
    command: '21A1',
    startByte: 50,
    numBits: 16,
    header: 'accelerator_position',
    decoder: 'acceleratorPositionDecoder',
  },
  {
    command: '21A1',
    startByte: 25,
    numBits: 16,
    header: 'engine_coolant_temp',
    decoder: 'temperatureDecoder',
  },
  {
    command: '21A1',
    startByte: 27,
    numBits: 16,
    header: 'intake_air_temp',
    decoder: 'temperatureDecoder',
  },
  {
    command: '21A5',
    startByte: 9,
    numBits: 16,
    header: 'fuel_per_stroke',
    decoder: 'fuelPerStrokeDecoder',
  },
];
