import amqplib from 'amqplib';
import type { Channel, ConfirmChannel } from 'amqplib';
import mongoose, {Types} from 'mongoose';
import { TripModel } from './models/trip.model';
import { SampleModel, ISample } from './models/sample.model';
import { ModelModel, IModel } from "./models/model.model";

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

  const thisIsTrainingTrip = model.trainTripsIds.includes(tripOid);
  const thisIsValTrip = model.valTripsIds.includes(tripOid);

  if ( thisIsTrainingTrip || thisIsValTrip ) {
    console.log(`Trip ${tripIdRaw} already assigned to model ${model._id}, skipping assignment`);
    console.log(`Trip ${tripIdRaw} analysis complete`);
    return;
  }

  let trainingTriggered = false;

  if (model.trainSamples < TRAIN_BATCH_AMOUNT) {
    model.trainTripsIds.push(tripOid);
    model.trainSamples += samples.length;

    console.log(`Assigned trip ${tripIdRaw} to training set of model ${model._id}`);
  } else if (model.valSamples < VALIDATION_BATCH_AMOUNT) {
    model.valTripsIds.push(tripOid);
    model.valSamples += samples.length;
    if (model.valSamples >= VALIDATION_BATCH_AMOUNT) trainingTriggered = true;

    console.log(`Assigned trip ${tripIdRaw} to validation set of model ${model._id}`);
  } else {
    predictCh.sendToQueue(QUEUE_PREDICTOR, Buffer.from(JSON.stringify({ tripId: tripIdRaw, vehicleId: trip.vehicleId.toString(), version: model.version })), { persistent: true });

    console.log(`Model ${model._id} already has enough training and validation data, not assigning trip ${tripIdRaw}, sent for prediction`);
  }

  await model.save();

  if (trainingTriggered) {
    publishCh.sendToQueue(QUEUE_OUT, Buffer.from(JSON.stringify({ vehicleId: trip.vehicleId.toString(), version: model.version, modelId: model._id.toString() })), { persistent: true });
    console.log(`Published model ${model._id} for training`);
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
    route: [] as { latitude: number, longitude: number }[],
  };

  let totalSpeed = 0;
  let totalRpm = 0;
  let totalFuelRateMlps = 0;      // <-- accumulate ml/s

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];

    totalSpeed += s.obd.vehicleSpeed;
    totalRpm   += s.obd.engineRpm;
    totalFuelRateMlps += s.obd.fuelConsumptionRate; // ml/s

    if (s.obd.vehicleSpeed > summary.maxSpeedKph) summary.maxSpeedKph = s.obd.vehicleSpeed;
    if (s.obd.engineRpm    > summary.maxRpm)      summary.maxRpm     = s.obd.engineRpm;

    if (i > 0) {
      const p = samples[i - 1];
      const dt = (s.timestamp.getTime() - p.timestamp.getTime()) / 1000; // s

      summary.durationSec += dt;

      // If you still want speed-based distance here:
      summary.distanceKm += (s.obd.vehicleSpeed / 3600) * dt;

      // Fuel used: ml/s -> L over dt
      summary.fuelUsedL += (s.obd.fuelConsumptionRate / 1000) * dt;

      if (s.gps.latitude !== p.gps.latitude || s.gps.longitude !== p.gps.longitude) {
        summary.route.push({ latitude: s.gps.latitude, longitude: s.gps.longitude });
      }
    } else {
      summary.route.push({ latitude: s.gps.latitude, longitude: s.gps.longitude });
    }
  }

  const n = Math.max(1, samples.length);
  summary.avgSpeedKph   = parseFloat((totalSpeed / n).toFixed(1));
  summary.avgRpm        = Math.round(totalRpm / n);

  // Average ml/s -> L/h
  const avgMlps = totalFuelRateMlps / n;
  summary.avgFuelRateLph = parseFloat((avgMlps * 3.6).toFixed(2));

  // Final rounding / formatting
  summary.distanceKm = parseFloat(summary.distanceKm.toFixed(2));
  summary.fuelUsedL  = parseFloat(summary.fuelUsedL.toFixed(2));
  summary.maxSpeedKph = Math.round(summary.maxSpeedKph);
  summary.maxRpm      = Math.round(summary.maxRpm);

  return summary;
};

const startService = async () => {
  await connectDB();
  await connectRabbitMQ();
};

startService();