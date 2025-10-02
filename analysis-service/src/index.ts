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
  let totalFuelRate = 0;

  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    totalSpeed += sample.obd.vehicleSpeed;
    totalRpm += sample.obd.engineRpm;
    totalFuelRate += sample.obd.fuelConsumptionRate;

    if (sample.obd.vehicleSpeed > summary.maxSpeedKph) {
      summary.maxSpeedKph = sample.obd.vehicleSpeed;
    }
    if (sample.obd.engineRpm > summary.maxRpm) {
      summary.maxRpm = sample.obd.engineRpm;
    }

    if (i > 0) {
      const prevSample = samples[i - 1];
      const timeDiff = (sample.timestamp.getTime() - prevSample.timestamp.getTime()) / 1000; // in seconds
      summary.durationSec += timeDiff;
      summary.distanceKm += (sample.obd.vehicleSpeed / 3600) * timeDiff;
      summary.fuelUsedL += (sample.obd.fuelConsumptionRate / 3600) * timeDiff;

      if (sample.gps.latitude !== prevSample.gps.latitude || sample.gps.longitude !== prevSample.gps.longitude) {
        summary.route.push({
          latitude: sample.gps.latitude,
          longitude: sample.gps.longitude,
        });
      }
    } else {
      summary.route.push({
        latitude: sample.gps.latitude,
        longitude: sample.gps.longitude,
      });
    }
  }

  summary.avgSpeedKph = parseFloat((totalSpeed / samples.length).toFixed(1));
  summary.avgRpm = Math.round(totalRpm / samples.length);
  summary.avgFuelRateLph = parseFloat((totalFuelRate / samples.length).toFixed(2));
  summary.distanceKm = parseFloat(summary.distanceKm.toFixed(2));
  summary.fuelUsedL = parseFloat(summary.fuelUsedL.toFixed(2));
  summary.maxSpeedKph = Math.round(summary.maxSpeedKph);
  summary.maxRpm = Math.round(summary.maxRpm);

  return summary;
};

const startService = async () => {
  await connectDB();
  await connectRabbitMQ();
};

startService();