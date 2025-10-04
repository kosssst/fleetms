import amqp from 'amqplib';
import mongoose from 'mongoose';
import { TripModel, ITrip } from './models/trip.model';
import { SampleModel, ISample } from './models/sample.model';

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/fleetms';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq';

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
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    await channel.assertQueue('trip_analysis', { durable: true });
    console.log('Connected to RabbitMQ');

    channel.consume('trip_analysis', async (msg) => {
      if (msg) {
        const { tripId } = JSON.parse(msg.content.toString());
        await analyzeTrip(tripId);
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Failed to connect to RabbitMQ', error);
    setTimeout(connectRabbitMQ, 5000);
  }
};

const analyzeTrip = async (tripId: string) => {
  console.log(`Analyzing trip ${tripId}`);
  const samples = await SampleModel.find({ tripId: new mongoose.Types.ObjectId(tripId) }).sort({ timestamp: 1 });
  const trip = await TripModel.findById(new mongoose.Types.ObjectId(tripId));

  if (!trip || samples.length === 0) {
    console.log(`Trip ${tripId} not found or has no samples`);
    return;
  }

  const summary = calculateSummary(samples);
  trip.summary = summary;
  await trip.save();
  console.log(`Trip ${tripId} analysis complete`);
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