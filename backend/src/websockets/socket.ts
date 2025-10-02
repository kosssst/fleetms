import { SampleModel } from '../models/sample.model';

import { Server } from 'http';
import WebSocket from 'ws';
import { Buffer } from 'buffer';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/user.model';
import { VehicleModel } from '../models/vehicle.model';
import { TripModel } from '../models/trip.model';
import { Types } from 'mongoose';

import { sendToQueue } from '../services/rabbitmq.service';

// --- Protocol Constants ---
const FrameType = { CONTROL: 0, DATA: 1 };
const CommandType = { 
  AUTH_REQ: 0x00, AUTH_OK: 0x01,
  START_TRIP_REQ: 0x02, START_TRIP_OK: 0x03,
  RESUME_TRIP_REQ: 0x04, RESUME_TRIP_OK: 0x05,
  END_TRIP_REQ: 0x06, END_TRIP_OK: 0x07,
  ACK: 0x08, ERROR: 0x09,
  PING: 0x0A, PONG: 0x0B,
  PAUSE_TRIP_REQ: 0x0C, PAUSE_TRIP_OK: 0x0D,
  CONFIG_REQ: 0x0E, CONFIG_ACK: 0x0F,
};
const getCommandName = (value: number) => {
  const entry = Object.entries(CommandType).find(([_, val]) => val === value);
  return entry ? entry[0] : `UNKNOWN(0x${value.toString(16)})`;
};

// Error Codes for ERROR frame
const ErrorCode = {
  AUTH_FAILED: 0x01,
  INVALID_TRIP: 0x02,
};

// --- Helper Functions ---
/* eslint-disable no-bitwise */
const getFrameType = (header: number) => (header >> 7) & 0x01;
/* eslint-enable no-bitwise */

class ClientConnection {
  private ws: WebSocket;
  private isAuthenticated = false;
  private userId: Types.ObjectId | null = null; // <-- Added
  private vehicleId: Types.ObjectId | null = null;
  private tripId: Types.ObjectId | null = null;
  private n1: number = 10; // Default ACK threshold
  private receivedFramesSinceAck: number = 0;

  constructor(ws: WebSocket) {
    this.ws = ws;
    console.log('New client connected.');
    this.ws.on('message', this.handleMessage.bind(this));
    this.ws.on('close', () => console.log('Client disconnected.'));
    this.ws.on('error', (err) => console.error('WebSocket error:', err));
  }

  private async handleMessage(message: Buffer) {
    try {
      const header = message.readUInt8(0);
      const frameType = getFrameType(header);

      if (frameType === FrameType.CONTROL) {
        const commandType = header;
        console.log(`Received CONTROL: ${getCommandName(commandType)}`);
        await this.handleControlMessage(commandType, message);
      } else {
        if (!this.isAuthenticated || !this.tripId) {
          console.error('Received DATA frame from unauthenticated or trip-less client.');
          this.ws.close(1008, 'Not ready for data');
          return;
        }
        // eslint-disable-next-line no-bitwise
        const recordCount = header & 0x3F;
        console.log(`Received DATA with ${recordCount} records.`);
        await this.handleDataMessage(recordCount, message.slice(1));
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.ws.close(1011, 'Internal server error');
    }
  }

  private async handleControlMessage(command: number, message: Buffer) {
    if (command !== CommandType.AUTH_REQ && !this.isAuthenticated) {
      return this.ws.close(1008, 'Authentication required');
    }

    switch (command) {
      case CommandType.AUTH_REQ:
        try {
          const tokenLength = message.readUInt16BE(1);
          const token = message.slice(3, 3 + tokenLength).toString('utf-8');
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
          const user = await UserModel.findById(decoded.id);

          if (!user) {
            throw new Error('User not found for the given token');
          }
          
          const vehicle = await VehicleModel.findOne({ driverId: user._id });

          if (!vehicle) {
            throw new Error('No vehicle is assigned to this user');
          }

          this.isAuthenticated = true;
          this.userId = user._id as Types.ObjectId; // <-- Added
          this.vehicleId = vehicle._id as Types.ObjectId;

          const sessionId = Buffer.from('mock-session-id', 'utf-8');
          const response = Buffer.alloc(3 + sessionId.length);
          response.writeUInt8(CommandType.AUTH_OK, 0);
          response.writeUInt16BE(sessionId.length, 1);
          sessionId.copy(response, 3);
          this.send(response);
        } catch (err) {
          const errorMessage = (err as Error).message || 'Authentication failed';
          console.error('Authentication failed:', errorMessage);
          
          const messageBytes = Buffer.from(errorMessage, 'utf-8');
          const errorResponse = Buffer.alloc(4 + messageBytes.length);
          
          errorResponse.writeUInt8(CommandType.ERROR, 0);
          errorResponse.writeUInt8(ErrorCode.AUTH_FAILED, 1);
          errorResponse.writeUInt16BE(messageBytes.length, 2);
          messageBytes.copy(errorResponse, 4);
          
          this.send(errorResponse);
        }
        break;

      case CommandType.CONFIG_REQ:
        const response = Buffer.alloc(9);
        response.writeUInt8(CommandType.CONFIG_ACK, 0);
        response.writeUInt16BE(6, 1); // Payload length
        response.writeUInt16BE(this.n1, 3);
        response.writeUInt16BE(30, 5);
        response.writeUInt16BE(10, 7);
        this.send(response);
        break;

      case CommandType.START_TRIP_REQ:
        if (!this.userId) { // <-- Added check
          return this.ws.close(1008, 'User not authenticated for trip start');
        }
        const user = await UserModel.findById(this.userId); // <-- Added user fetch
        if (!user) {
          return this.ws.close(1008, 'User not found');
        }

        const newTrip = new TripModel({ 
          vehicleId: this.vehicleId, 
          driverId: this.userId, // <-- Added
          companyId: user.companyId, // <-- Added
          startTime: new Date(), 
          dataPoints: [], 
          status: 'ongoing' 
        });
        await newTrip.save();
        this.tripId = newTrip._id as Types.ObjectId;

        const tripIdBytes = Buffer.from(this.tripId.toHexString(), 'hex');
        const startResponse = Buffer.alloc(3 + tripIdBytes.length);
        startResponse.writeUInt8(CommandType.START_TRIP_OK, 0);
        startResponse.writeUInt16BE(tripIdBytes.length, 1);
        tripIdBytes.copy(startResponse, 3);
        this.send(startResponse);
        break;

      case CommandType.RESUME_TRIP_REQ:
        const tripIdLength = message.readUInt16BE(1);
        const tripIdHex = message.slice(3, 3 + tripIdLength).toString('hex');
        const existingTrip = await TripModel.findById(tripIdHex);
        if (!existingTrip || existingTrip.vehicleId.toString() !== this.vehicleId?.toString()) {
          return this.ws.close(1002, 'Invalid trip');
        }
        this.tripId = existingTrip._id as Types.ObjectId;
        this.send(Buffer.from([CommandType.RESUME_TRIP_OK]));
        break;

      case CommandType.PAUSE_TRIP_REQ:
        if (this.tripId) await TripModel.findByIdAndUpdate(this.tripId, { $set: { status: 'paused' } });
        this.send(Buffer.from([CommandType.PAUSE_TRIP_OK]));
        break;

      case CommandType.END_TRIP_REQ:
        if (this.tripId) {
          await TripModel.findByIdAndUpdate(this.tripId, { $set: { status: 'completed', endTime: new Date() } });
          sendToQueue(JSON.stringify({ tripId: this.tripId }));
        }
        this.tripId = null;
        this.send(Buffer.from([CommandType.END_TRIP_OK]));
        break;

      case CommandType.PING:
        this.send(Buffer.from([CommandType.PONG]));
        break;
    }
  }

  private async handleDataMessage(recordCount: number, data: Buffer) {
    if (!this.tripId) return;
    const samples = [];
    for (let i = 0; i < recordCount; i++) {
      const offset = i * 32;
      if (offset + 32 > data.length) {
        console.error('Invalid data frame length.');
        break;
      }
      const record = data.slice(offset, offset + 32);
      samples.push({
        tripId: this.tripId,
        timestamp: new Date(Number(record.readBigUInt64BE(0))),
        gps: {
          longitude: record.readInt32BE(8) / 10000000,
          latitude: record.readInt32BE(12) / 10000000,
          altitude: record.readInt32BE(16),
        },
        obd: {
          vehicleSpeed: record.readUInt16BE(20),
          engineRpm: record.readUInt16BE(22),
          acceleratorPosition: record.readUInt16BE(24),
          engineCoolantTemp: record.readUInt16BE(26),
          intakeAirTemp: record.readUInt16BE(28),
          fuelConsumptionRate: record.readUInt16BE(30),
        },
      });
    }

    if (samples.length > 0) {
      await SampleModel.insertMany(samples);
      await TripModel.findByIdAndUpdate(this.tripId, { $inc: { samplesReceived: samples.length } });
    }

    this.receivedFramesSinceAck += recordCount;
    if (this.receivedFramesSinceAck >= this.n1) {
      this.send(Buffer.from([CommandType.ACK]));
      this.receivedFramesSinceAck = 0;
    }
  }

  private send(message: Buffer) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    }
  }
}

export const initWebSocketServer = (server: Server) => {
  const wss = new WebSocket.Server({ server });
  wss.on('connection', (ws: WebSocket) => {
    new ClientConnection(ws);
  });
  console.log('WebSocket server initialized');
};