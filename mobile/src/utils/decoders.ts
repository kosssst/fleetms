const u16Be = (payload: Buffer): number => {
  if (payload.length < 2) {
    // Return a default or throw an error if payload is too short
    return 0;
  }
  return payload.readUInt16BE(0);
};

export const vehicleSpeedDecoder = (payload: Buffer): number => {
  const raw = u16Be(payload);
  return raw / 100.0; // km/h
};

export const engineSpeedDecoder = (payload: Buffer): number => {
  const raw = u16Be(payload);
  return raw * 1.0; // rpm
};

const ZERO_RAW = 0x0097;
const FULL_RAW = 0x0339;
const MAX_PERCENT = 100.0;

export const acceleratorPositionDecoder = (payload: Buffer): number => {
  const raw = u16Be(payload);
  if (raw <= ZERO_RAW) {
    return 0.0;
  }
  if (raw >= FULL_RAW) {
    return MAX_PERCENT;
  }
  return ((raw - ZERO_RAW) * (MAX_PERCENT / (FULL_RAW - ZERO_RAW)));
};

export const temperatureDecoder = (payload: Buffer): number => {
  const raw = u16Be(payload);
  return raw / 10.0 - 273.15; // °C
};

export const fuelPerStrokeDecoder = (payload: Buffer): number => {
  const raw = u16Be(payload);
  return raw * 0.01;
};