import amqplib from 'amqplib';
import type { Channel, ConfirmChannel } from 'amqplib';
import mongoose, {Types} from 'mongoose';
import { TripModel } from './models/trip.model';
import { SampleModel, ISample } from './models/sample.model';
import { ModelModel, IModel } from "./models/model.model";
import {VehicleModel} from "./models/vehicle.model";

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
  };

  const MOTION_SPEED_THRESHOLD_KPH = 0.5;

  let totalSpeed = 0;
  let totalRpm = 0;
  let totalFuelRateMlps = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];

    const spd = Number.isFinite(s.obd.vehicleSpeed) ? s.obd.vehicleSpeed : 0;
    const rpm = Number.isFinite(s.obd.engineRpm) ? s.obd.engineRpm : 0;
    const rateMlps = Number.isFinite(s.obd.fuelConsumptionRate) ? s.obd.fuelConsumptionRate : 0;

    totalSpeed += spd;
    totalRpm += rpm;
    totalFuelRateMlps += rateMlps;

    if (spd > summary.maxSpeedKph) summary.maxSpeedKph = spd;
    if (rpm > summary.maxRpm) summary.maxRpm = rpm;

    if (i > 0) {
      const p = samples[i - 1];

      const prevSpd = Number.isFinite(p.obd.vehicleSpeed) ? p.obd.vehicleSpeed : 0;
      const prevRate = Number.isFinite(p.obd.fuelConsumptionRate) ? p.obd.fuelConsumptionRate : 0;

      const dt = (s.timestamp.getTime() - p.timestamp.getTime()) / 1000; // s
      if (dt <= 0 || !Number.isFinite(dt)) continue;

      summary.durationSec += dt;

      summary.distanceKm += (spd / 3600) * dt;

      const rateAvgMlps = (rateMlps + prevRate) / 2;
      const fuelThisIntervalL = (rateAvgMlps / 1000) * dt;
      summary.fuelUsedL += fuelThisIntervalL;

      const avgSpd = (spd + prevSpd) / 2;
      const isMoving = avgSpd >= MOTION_SPEED_THRESHOLD_KPH;

      if (isMoving) {
        summary.motionDurationSec += dt;
        summary.fuelUsedInMotionL += fuelThisIntervalL;
      } else {
        summary.idleDurationSec += dt;
        summary.fuelUsedInIdleL += fuelThisIntervalL;
      }

      if (s.gps.latitude !== p.gps.latitude || s.gps.longitude !== p.gps.longitude) {
        summary.route.push({ latitude: s.gps.latitude, longitude: s.gps.longitude });
      }
    } else {
      summary.route.push({ latitude: s.gps.latitude, longitude: s.gps.longitude });
    }
  }

  const n = Math.max(1, samples.length);
  summary.avgSpeedKph = parseFloat((totalSpeed / n).toFixed(1));
  summary.avgRpm = Math.round(totalRpm / n);

  const avgMlps = totalFuelRateMlps / n;
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