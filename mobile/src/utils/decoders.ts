export const u16Be = (payload: Buffer): number => {
  return payload.readUInt16BE(0);
};

export const vehicleSpeedDecoder = (raw: number): number => {
  return raw / 100.0; // km/h
};

export const engineSpeedDecoder = (raw: number): number => {
  return raw * 1.0; // rpm
};

const ZERO_RAW = 0x0097;
const FULL_RAW = 0x0339;
const MAX_PERCENT = 100.0;

export const acceleratorPositionDecoder = (raw: number): number => {
  if (raw <= ZERO_RAW) {
    return 0.0;
  }
  if (raw >= FULL_RAW) {
    return MAX_PERCENT;
  }
  return ((raw - ZERO_RAW) * (MAX_PERCENT / (FULL_RAW - ZERO_RAW)));
};

export const temperatureDecoder = (raw: number): number => {
  return raw / 10.0 - 273.15; // °C
};

export const fuelPerStrokeDecoder = (raw: number): number => {
  return raw * 0.1;
};
