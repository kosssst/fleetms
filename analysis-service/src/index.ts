import amqplib from 'amqplib';
import type { Channel, ConfirmChannel } from 'amqplib';
import mongoose, { Types } from 'mongoose';
import { TripModel } from './models/trip.model';
import { SampleModel, ISample } from './models/sample.model';
import { ModelModel } from "./models/model.model";
import { VehicleModel } from "./models/vehicle.model";

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/fleetms';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq';
const TRAIN_BATCH_AMOUNT = parseInt(process.env.TRAIN_BATCH_AMOUNT || '20000', 10);
const VALIDATION_BATCH_AMOUNT = parseInt(process.env.VALIDATION_BATCH_AMOUNT || '5000', 10);

const QUEUE_IN  = 'trip-analysis';
const QUEUE_OUT = 'model-train';
const QUEUE_PREDICTOR = 'predict.trip';

let mqConn;
let consumeCh: Channel;
let publishCh: ConfirmChannel;
let predictCh: ConfirmChannel;

type SpeedPoint = {
  timestamp: Date;
  obdSpeedKph: number;
  gpsSpeedKph: number;
  mergedSpeedKph: number;
};

function toObjectId(id: string) {
  if (Types.ObjectId.isValid(id)) return new Types.ObjectId(id);
  return null;
}

const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    process.exit(1);
  }
};

const connectRabbitMQ = async () => {
  mqConn = await amqplib.connect(RABBITMQ_URL);

  consumeCh = await mqConn.createChannel();
  await consumeCh.assertQueue(QUEUE_IN, { durable: true });
  await consumeCh.prefetch(1);

  publishCh = await mqConn.createConfirmChannel();
  await publishCh.assertQueue(QUEUE_OUT, { durable: true });

  predictCh = await mqConn.createConfirmChannel();
  await predictCh.assertQueue(QUEUE_PREDICTOR, { durable: true });

  console.log('Connected to RabbitMQ');

  consumeCh.consume(QUEUE_IN, async (msg) => {
    if (!msg) return;
    try {
      const { tripId } = JSON.parse(msg.content.toString());
      await analyzeTrip(tripId);
    } catch (err) {
      console.error('Failed to analyze message:', err);
    } finally {
      consumeCh.ack(msg);
    }
  });
};

const analyzeTrip = async (tripIdRaw: string) => {
  console.log(`Analyzing trip ${tripIdRaw}`);

  const tripOid = toObjectId(tripIdRaw);
  if (!tripOid) {
    console.warn(`Invalid tripId: ${tripIdRaw}`);
    return;
  }

  const trip = await TripModel.findById(tripOid);
  if (!trip) {
    console.warn(`Trip ${tripIdRaw} not found`);
    return;
  }

  let vehicle = await VehicleModel.findById(trip.vehicleId);
  if (!vehicle) {
    console.warn(`Vehicle ${trip.vehicleId} not found for trip ${tripIdRaw}`);
    return;
  }

  let model = await ModelModel
    .findOne({ vehicleId: trip.vehicleId })
    .sort({ createdAt: -1 })
    .catch(err => {
      console.warn('Model lookup failed:', err);
      return null;
    });

  if (!model) {
    const createdDoc = await ModelModel.create({
      vehicleId: trip.vehicleId,
      version: new Date().toISOString().replace(/[:.]/g, '-'),
      createdAt: new Date(),
      status: 'pending',
      trainTripIds: [],
      valTripIds: [],
      trainSamples: 0,
      valSamples: 0,
    });

    console.log(
      `Created new model manifest for vehicle ${trip.vehicleId}:`,
      (createdDoc._id as Types.ObjectId).toString()
    );

    const createdPlain = createdDoc.toObject();
    (createdPlain as any)._id = createdDoc._id;

    type NonNullModel = NonNullable<typeof model>;
    model = createdPlain as NonNullModel;
  }

  const samples = await SampleModel
    .find({ tripId: tripOid })
    .sort({ timestamp: 1 })
    .lean();

  if (!samples.length) {
    console.log(`Trip ${tripIdRaw} has no samples`);
    return;
  }

  const summary = calculateSummary(samples);

  trip.summary = summary as any;
  (trip as any).numSamples = samples.length;
  await trip.save();

  if (!vehicle.tripsUsedInTotalDistanceAndFuel) vehicle.tripsUsedInTotalDistanceAndFuel = [];
  if (vehicle.tripsUsedInTotalDistanceAndFuel.includes(trip._id)){
    console.log(`Trip ${tripIdRaw} already counted in vehicle ${vehicle._id} totals`);
  } else {
    vehicle.totalDistanceKm += summary.distanceKm;
    vehicle.totalFuelUsedL += summary.fuelUsedL;
    vehicle.tripsUsedInTotalDistanceAndFuel.push(trip._id);
    await vehicle.save();
    console.log(`Updated vehicle ${vehicle._id} totals with trip ${tripIdRaw}`);
  }

  const thisIsTrainingTrip = model.trainTripsIds.includes(tripOid);
  const thisIsValTrip = model.valTripsIds.includes(tripOid);

  if ( thisIsTrainingTrip || thisIsValTrip ) {
    console.log(`Trip ${tripIdRaw} already assigned to model ${model._id}, skipping assignment`);
    console.log(`Trip ${tripIdRaw} analysis complete`);
    return;
  }

  let trainingTriggered = false;
  let predictionTriggered = false;

  if (model.trainSamples < TRAIN_BATCH_AMOUNT) {
    model.trainTripsIds.push(tripOid);
    model.trainSamples += samples.length;
    trip.role = 'train';

    console.log(`Assigned trip ${tripIdRaw} to training set of model ${model._id}`);
  } else if (model.valSamples < VALIDATION_BATCH_AMOUNT) {
    model.valTripsIds.push(tripOid);
    model.valSamples += samples.length;
    trip.role = 'validation';
    if (model.valSamples >= VALIDATION_BATCH_AMOUNT) trainingTriggered = true;

    console.log(`Assigned trip ${tripIdRaw} to validation set of model ${model._id}`);
  } else {
    trip.role = 'prediction';
    predictionTriggered = true;
    console.log(`Model ${model._id} already has enough training and validation data, not assigning trip ${tripIdRaw}`);
  }

  await model.save();
  await trip.save();

  if (trainingTriggered) {
    publishCh.sendToQueue(QUEUE_OUT, Buffer.from(JSON.stringify({ vehicleId: trip.vehicleId.toString(), version: model.version, modelId: model._id.toString() })), { persistent: true });
    console.log(`Published model ${model._id} for training`);
  }

  if (predictionTriggered) {
    predictCh.sendToQueue(QUEUE_PREDICTOR, Buffer.from(JSON.stringify({ tripId: tripIdRaw, vehicleId: trip.vehicleId.toString(), version: model.version })), { persistent: true });
    console.log(`Published trip ${tripIdRaw} for prediction`);
  }

  console.log(`Trip ${tripIdRaw} analysis complete`);
};

const calculateSummary = (samples: ISample[]) => {
  const summary = {
    durationSec: 0,
    distanceKm: 0,
    avgSpeedKph: 0,
    maxSpeedKph: 0,
    avgRpm: 0,
    maxRpm: 0,
    fuelUsedL: 0,
    avgFuelRateLph: 0,
    route: [] as { latitude: number; longitude: number }[],
    fuelUsedInIdleL: 0,
    fuelUsedInMotionL: 0,
    idleDurationSec: 0,
    motionDurationSec: 0,
    speedProfile: [] as SpeedPoint[],
  };

  if (!samples || samples.length === 0) return summary;

  // ---------------------- ПАРАМЕТРИ ----------------------
  const MOTION_SPEED_THRESHOLD_KPH = 0.5;

  // GPS сегментування/фільтрація (для графіка)
  const GPS_SAME_EPS_M = 10.0;
  const GPS_MIN_SPAN_S = 1.5;
  const GPS_MAX_SPAN_S = 15.0;
  const GPS_GAP_S = 6.0;

  const MED_WIN = 5;
  const HAMPEL_WIN = 5;
  const HAMPEL_K = 3;
  const VMAX_KPH = 160.0;

  // Фізика
  const A_ACCEL_MAX_MS2 = 6.0;
  const A_DECEL_MAX_MS2 = 6.0;
  const PHYS_MARGIN_KPH = 5.0;

  // Злиття (виключно для графіка)
  const BASE_ALPHA_OBD = 0.8;
  const MISMATCH_THR_KPH = 5.0;
  const MAX_ALPHA_OBD = 0.98;
  const EPS_MERGE_DEADZONE = 0.1;
  const REL_SPIKE_OVER_OBD_KPH = 8.0;
  const REL_SPIKE_RATIO_OVER_OBD = 1.25;

  // ---------------------- ХЕЛПЕРИ ----------------------
  const clampNum = (v: unknown, def = 0) => (Number.isFinite(v as number) ? (v as number) : def);
  const toTs = (d: Date) => d.getTime() / 1000;

  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371.0;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const a = [...arr].sort((x, y) => x - y);
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };

  const windowSlice = (arr: number[], i: number, win: number) => {
    const half = Math.floor(win / 2);
    const a = Math.max(0, i - half);
    const b = Math.min(arr.length - 1, i + half);
    return arr.slice(a, b + 1);
  };

  const hampelFilter = (x: number[], win: number, k: number) => {
    const out = x.slice();
    for (let i = 0; i < x.length; i++) {
      const w = windowSlice(x, i, win);
      const med = median(w);
      const absDev = w.map((v) => Math.abs(v - med));
      const mad = median(absDev) || 1e-6;
      if (Math.abs(x[i] - med) > k * 1.4826 * mad) out[i] = med;
    }
    return out;
  };

  const enforceAccelBounds = (v: number[], ts: number[]) => {
    const out = v.slice();
    // forward
    for (let i = 1; i < out.length; i++) {
      const dt = Math.max(0, ts[i] - ts[i - 1]);
      if (!(dt > 0)) continue;
      const dvp = dt * A_ACCEL_MAX_MS2 * 3.6 + PHYS_MARGIN_KPH;
      const dvm = dt * A_DECEL_MAX_MS2 * 3.6 + PHYS_MARGIN_KPH;
      const up = out[i - 1] + dvp;
      const low = Math.max(0, out[i - 1] - dvm);
      out[i] = Math.min(Math.max(out[i], low), up);
    }
    // backward
    for (let i = out.length - 2; i >= 0; i--) {
      const dt = Math.max(0, ts[i + 1] - ts[i]);
      if (!(dt > 0)) continue;
      const dvp = dt * A_ACCEL_MAX_MS2 * 3.6 + PHYS_MARGIN_KPH;
      const dvm = dt * A_DECEL_MAX_MS2 * 3.6 + PHYS_MARGIN_KPH;
      const up = out[i + 1] + dvm;
      const low = Math.max(0, out[i + 1] - dvp);
      out[i] = Math.min(Math.max(out[i], low), up);
    }
    for (let i = 0; i < out.length; i++) out[i] = Math.min(Math.max(out[i], 0), VMAX_KPH);
    return out;
  };

  // ---------------------- ПЛОСКІ МАСИВИ ----------------------
  const n = samples.length;
  const lat = samples.map((s) => s.gps.latitude);
  const lon = samples.map((s) => s.gps.longitude);
  const ts = samples.map((s) => toTs(s.timestamp));
  const vObd = samples.map((s) => clampNum(s.obd.vehicleSpeed, 0));
  const rpm = samples.map((s) => clampNum(s.obd.engineRpm, 0));
  const rateMlps = samples.map((s) => clampNum(s.obd.fuelConsumptionRate, 0));

  // ---------------------- GPS для графіка (segment+fallback → median → Hampel → clamps) ----------------------
  const gpsSeg: number[] = new Array(n).fill(0);
  let anchor = 0;
  while (anchor < n - 1) {
    let j = anchor + 1;
    while (j < n) {
      const distM = haversineKm(lat[anchor], lon[anchor], lat[j], lon[j]) * 1000;
      if (Number.isFinite(distM) && distM > GPS_SAME_EPS_M) break;
      j++;
    }
    if (j < n) {
      const dt = ts[j] - ts[anchor];
      if (dt > GPS_MIN_SPAN_S && dt <= GPS_MAX_SPAN_S) {
        const distKm = haversineKm(lat[anchor], lon[anchor], lat[j], lon[j]);
        const vSeg = (distKm / dt) * 3600;
        for (let k = anchor + 1; k <= j; k++) gpsSeg[k] = vSeg;
      }
      anchor = j;
    } else break;
  }

  const gpsFallback: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const dt = ts[i] - ts[i - 1];
    const dKm = haversineKm(lat[i - 1], lon[i - 1], lat[i], lon[i]);
    gpsFallback[i] = dt > 0 && dt <= GPS_GAP_S ? (dKm / dt) * 3600 : 0;
  }

  const gpsRaw: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) gpsRaw[i] = gpsSeg[i] > 0 ? gpsSeg[i] : gpsFallback[i];

  const gpsMed = gpsRaw.map((_, i) => median(windowSlice(gpsRaw, i, MED_WIN)));
  const gpsHampel = hampelFilter(gpsMed, HAMPEL_WIN, HAMPEL_K);
  let gpsSmooth = gpsHampel.map((v) => (v > 0 ? Math.min(v, VMAX_KPH) : 0));

  for (let i = 1; i < n; i++) {
    const dt = Math.max(0, ts[i] - ts[i - 1]);
    if (!(dt > 0)) continue;
    const vPrevRef = Number.isFinite(vObd[i - 1]) ? vObd[i - 1] : gpsSmooth[i - 1];
    const dvp = dt * A_ACCEL_MAX_MS2 * 3.6 + PHYS_MARGIN_KPH;
    const dvm = dt * A_DECEL_MAX_MS2 * 3.6 + PHYS_MARGIN_KPH;
    const up = vPrevRef + dvp;
    const low = Math.max(0, vPrevRef - dvm);
    gpsSmooth[i] = Math.min(Math.max(gpsSmooth[i], low), up);
  }

  // анти-спайк GPS відносно OBD (лише для графіка)
  for (let i = 0; i < n; i++) {
    const so = vObd[i];
    const cap = Math.max(
      0,
      Math.min(so + REL_SPIKE_OVER_OBD_KPH, so * REL_SPIKE_RATIO_OVER_OBD, VMAX_KPH)
    );
    gpsSmooth[i] = Math.min(gpsSmooth[i], cap);
  }

  // злиття для графіка
  const merged: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const so = vObd[i];
    const sg = gpsSmooth[i];
    const diff = Math.abs(so - sg);
    let alpha = BASE_ALPHA_OBD;
    if (diff > MISMATCH_THR_KPH) {
      const t = Math.min(1, (diff - MISMATCH_THR_KPH) / 30);
      alpha = Math.min(MAX_ALPHA_OBD, BASE_ALPHA_OBD + t * (MAX_ALPHA_OBD - BASE_ALPHA_OBD));
    }
    if (!(sg > 0)) alpha = Math.max(alpha, 0.9);
    const fused = Math.abs(sg - so) <= EPS_MERGE_DEADZONE ? sg : alpha * so + (1 - alpha) * sg;
    merged[i] = Math.max(0, Math.min(fused, VMAX_KPH));
  }
  const mergedBounded = enforceAccelBounds(merged, ts);

  // ---------------------- ІНТЕГРАЦІЯ: лише OBD ----------------------
  let totalObdSpeed = 0;
  let totalRpm = 0;
  let totalFuelRateMlps = 0;

  for (let i = 0; i < n; i++) {
    const s = samples[i];

    const spdObd = vObd[i];
    const spdGps = gpsSmooth[i];       // для графіка
    const spdMerged = mergedBounded[i]; // для графіка
    const erpm = rpm[i];
    const rate = rateMlps[i];

    totalObdSpeed += spdObd;
    totalRpm += erpm;
    totalFuelRateMlps += rate;

    if (spdObd > summary.maxSpeedKph) summary.maxSpeedKph = spdObd;
    if (erpm > summary.maxRpm) summary.maxRpm = erpm;

    summary.speedProfile.push({
      timestamp: s.timestamp,
      obdSpeedKph: spdObd,
      gpsSpeedKph: spdGps,
      mergedSpeedKph: spdMerged,
    });

    if (i > 0) {
      const dt = ts[i] - ts[i - 1];
      if (!(dt > 0)) continue;

      summary.durationSec += dt;

      // Дистанція: **OBD only**
      const vAvgObd = (vObd[i] + vObd[i - 1]) / 2;
      summary.distanceKm += (vAvgObd / 3600) * dt;

      // Паливо: як і було (за витратою)
      const ratePrev = rateMlps[i - 1];
      const rateAvg = (rate + ratePrev) / 2;
      const fuelThisIntervalL = (rateAvg / 1000) * dt;
      summary.fuelUsedL += fuelThisIntervalL;

      // Idle/Motion: **за OBD**
      const isMoving = vAvgObd >= MOTION_SPEED_THRESHOLD_KPH;
      if (isMoving) {
        summary.motionDurationSec += dt;
        summary.fuelUsedInMotionL += fuelThisIntervalL;
      } else {
        summary.idleDurationSec += dt;
        summary.fuelUsedInIdleL += fuelThisIntervalL;
      }

      // Маршрут — як і було
      const p = samples[i - 1];
      if (s.gps.latitude !== p.gps.latitude || s.gps.longitude !== p.gps.longitude) {
        summary.route.push({ latitude: s.gps.latitude, longitude: s.gps.longitude });
      }
    } else {
      summary.route.push({ latitude: s.gps.latitude, longitude: s.gps.longitude });
    }
  }

  // Середні метрики з OBD
  const m = Math.max(1, n);
  summary.avgSpeedKph = parseFloat((totalObdSpeed / m).toFixed(1));
  summary.avgRpm = Math.round(totalRpm / m);

  const avgMlps = totalFuelRateMlps / m;
  summary.avgFuelRateLph = parseFloat((avgMlps * 3.6).toFixed(2));

  summary.distanceKm = parseFloat(summary.distanceKm.toFixed(2));
  summary.fuelUsedL = parseFloat(summary.fuelUsedL.toFixed(2));
  summary.fuelUsedInIdleL = parseFloat(summary.fuelUsedInIdleL.toFixed(2));
  summary.fuelUsedInMotionL = parseFloat(summary.fuelUsedInMotionL.toFixed(2));
  summary.maxSpeedKph = Math.round(summary.maxSpeedKph);
  summary.maxRpm = Math.round(summary.maxRpm);

  return summary;
};


const startService = async () => {
  await connectDB();
  await connectRabbitMQ();
};

startService();