import { Server } from 'http';
import WebSocket from 'ws';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { User } from '../types/user.types';
import { CompanyModel } from '../models/company.model';
import { TripModel, ITrip } from '../models/trip.model';
import { SampleModel } from '../models/sample.model';
import { VehicleModel, IVehicle } from '../models/vehicle.model';
import mongoose from 'mongoose';
import amqp from 'amqplib';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET as string;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:password@rabbitmq';
const N1 = parseInt(process.env.N1 || '10', 10);
const T1 = parseInt(process.env.T1 || '30', 10);
const T2 = parseInt(process.env.T2 || '60', 10);

// RabbitMQ channel
let rabbitChannel: amqp.Channel;

const connectRabbitMQ = async () => {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    rabbitChannel = await connection.createChannel();
    await rabbitChannel.assertQueue('trip_analysis', { durable: true });
    console.log('Connected to RabbitMQ');
  } catch (error) {
    console.error('Failed to connect to RabbitMQ', error);
    // Retry connection after a delay
    setTimeout(connectRabbitMQ, 5000);
  }
};

connectRabbitMQ();

export const createWebSocketServer = (server: Server) => {
  const wss = new WebSocket.Server({ server });

  wss.on('connection', (ws: WebSocket, req) => {
    let user: User | null = null;
    let vehicleId: mongoose.Types.ObjectId | null = null;
    let tripId: mongoose.Types.ObjectId | null = null;
    let sampleCounter = 0;

    const authenticate = async (token: string) => {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        const authenticatedUser = await UserModel.findById(decoded.id).select('-password');
        if (!authenticatedUser) {
          ws.close(1008, 'Invalid token');
          return;
        }
        user = authenticatedUser.toObject();
        const vehicle: IVehicle | null = await VehicleModel.findOne({ driverId: user._id });
        if (!vehicle) {
          ws.close(1008, 'No vehicle assigned to user');
          return;
        }
        vehicleId = vehicle._id as mongoose.Types.ObjectId;

        // Send AUTH_OK
        const session_id = new mongoose.Types.ObjectId().toHexString();
        const session_id_bytes = Buffer.from(session_id, 'hex');
        const header = Buffer.from([0x01]);
        const length = Buffer.alloc(2);
        length.writeUInt16BE(session_id_bytes.length, 0);
        const response = Buffer.concat([header, length, session_id_bytes]);
        ws.send(response);
      } catch (error) {
        ws.close(1008, 'Authentication failed');
      }
    };

    ws.on('message', async (message: Buffer) => {
      if (!Buffer.isBuffer(message)) {
        ws.close(1011, 'Invalid message format');
        return;
      }

      const header = message.readUInt8(0);
      const frameType = header & 0x01;

      if (frameType === 0) { // CONTROL frame
        const commandType = (header >> 2) & 0x3F;
        await handleControlFrame(commandType, message.slice(1));
      } else { // DATA frame
        if (!tripId) {
          ws.close(1002, 'Trip not started');
          return;
        }
        const numberOfDataFrames = (header >> 2) & 0x3F;
        await handleDataFrame(numberOfDataFrames, message.slice(1));
      }
    });

    const handleControlFrame = async (commandType: number, payload: Buffer) => {
      switch (commandType) {
        case 0x00: // AUTH_REQ
          const tokenLength = payload.readUInt16BE(0);
          const token = payload.slice(2, 2 + tokenLength).toString('utf-8');
          await authenticate(token);
          break;
        case 0x02: // START_TRIP_REQ
          if (!user || !vehicleId) {
            ws.close(1002, 'Not authenticated');
            return;
          }
          const newTrip: ITrip = await TripModel.create({
            driverId: user._id,
            vehicleId: vehicleId,
            companyId: user.companyId,
            status: 'ongoing',
            startTime: new Date(),
          });
          tripId = newTrip._id as mongoose.Types.ObjectId;
          const tripIdBytes = Buffer.from(tripId.toHexString(), 'hex');
          const header = Buffer.from([0x03]);
          const length = Buffer.alloc(2);
          length.writeUInt16BE(tripIdBytes.length, 0);
          const response = Buffer.concat([header, length, tripIdBytes]);
          ws.send(response);
          break;
        case 0x04: // RESUME_TRIP_REQ
          const resumeTripIdLength = payload.readUInt16BE(0);
          const resumeTripIdHex = payload.slice(2, 2 + resumeTripIdLength).toString('hex');
          const resumeTripId = new mongoose.Types.ObjectId(resumeTripIdHex);
          const existingTrip: ITrip | null = await TripModel.findById(resumeTripId);
          if (!existingTrip || existingTrip.status === 'ended') {
            ws.close(1002, 'Invalid trip');
            return;
          }
          tripId = existingTrip._id as mongoose.Types.ObjectId;
          existingTrip.status = 'ongoing';
          await existingTrip.save();
          ws.send(Buffer.from([0x05]));
          break;
        case 0x06: // END_TRIP_REQ
          if (!tripId) {
            ws.close(1002, 'Trip not started');
            return;
          }
          await TripModel.findByIdAndUpdate(tripId, { status: 'ended', endTime: new Date() });
          if (rabbitChannel && tripId) {
            rabbitChannel.sendToQueue('trip_analysis', Buffer.from(JSON.stringify({ tripId: tripId.toHexString() })));
          }
          ws.send(Buffer.from([0x07]));
          tripId = null;
          break;
        case 0x0A: // PING
          ws.send(Buffer.from([0x0B])); // PONG
          break;
        case 0x0C: // PAUSE_TRIP_REQ
          if (!tripId) {
            ws.close(1002, 'Trip not started');
            return;
          }
          await TripModel.findByIdAndUpdate(tripId, { status: 'paused' });
          ws.send(Buffer.from([0x0D]));
          break;
        case 0x0E: // CONFIG_REQ
          const configHeader = Buffer.from([0x0F]);
          const configPayload = Buffer.alloc(6);
          configPayload.writeUInt16BE(N1, 0);
          configPayload.writeUInt16BE(T1, 2);
          configPayload.writeUInt16BE(T2, 4);
          const configResponse = Buffer.concat([configHeader, configPayload]);
          ws.send(configResponse);
          break;
      }
    };

    const handleDataFrame = async (numberOfDataFrames: number, payload: Buffer) => {
      const samples = [];
      for (let i = 0; i < numberOfDataFrames; i++) {
        const frame = payload.slice(i * 32, (i + 1) * 32);
        const sample = {
          tripId: tripId,
          timestamp: new Date(Number(frame.readBigUInt64BE(0))),
          gps: {
            longitude: frame.readInt32BE(8),
            latitude: frame.readInt32BE(12),
            altitude: frame.readInt32BE(16),
          },
          obd: {
            vehicleSpeed: frame.readUInt16BE(20) / 100.0,
            engineRpm: frame.readUInt16BE(22),
            acceleratorPosition: (frame.readUInt16BE(24) - 0x0097) * (100 / (0x0339 - 0x0097)),
            engineCoolantTemp: (frame.readUInt16BE(26) / 10.0) - 273.15,
            intakeAirTemp: (frame.readUInt16BE(28) / 10.0) - 273.15,
            fuelConsumptionRate: frame.readUInt16BE(30),
          },
        };
        samples.push(sample);
      }
      await SampleModel.insertMany(samples);
      sampleCounter += numberOfDataFrames;
      if (sampleCounter >= N1) {
        ws.send(Buffer.from([0x08])); // ACK
        sampleCounter = 0;
      }
    };

    ws.on('close', () => {
      console.log('Client disconnected');
    });
  });
};