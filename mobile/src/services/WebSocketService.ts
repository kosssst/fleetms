import { io, Socket } from 'socket.io-client';
import { getToken } from '../utils/auth';
import { Buffer } from 'buffer';

class WebSocketService {
  private socket: Socket | null = null;
  private tripId: string | null = null;
  private sessionId: string | null = null;
  private n1: number = 1;
  private t1: number = 10;
  private t2: number = 20;
  private pingInterval: any = null;
  private pingTimeout: any = null;

  connect() {
    this.socket = io('ws://localhost:3000', {
      transports: ['websocket'],
    });

    this.socket.on('connect', async () => {
      console.log('WebSocket connected');
      await this.authenticate();
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.clearPingInterval();
    });

    this.socket.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });
  }

  private async authenticate() {
    const token = await getToken();
    if (token) {
      const tokenBuffer = Buffer.from(token);
      const header = Buffer.alloc(3);
      header.writeUInt8(0x00, 0);
      header.writeUInt16BE(tokenBuffer.length, 1);
      const authRequest = Buffer.concat([header, tokenBuffer]);
      this.socket?.send(authRequest);
    }
  }

  private handleMessage(data: Buffer) {
    const header = data.readUInt8(0);
    const frameType = header & 0x01;

    if (frameType === 0) {
      // Control Frame
      const command = header >> 2;
      switch (command) {
        case 0x01: // AUTH_OK
          this.handleAuthOk(data);
          break;
        case 0x03: // START_TRIP_OK
          this.handleStartTripOk(data);
          break;
        case 0x05: // RESUME_TRIP_OK
          break;
        case 0x07: // END_TRIP_OK
          this.tripId = null;
          break;
        case 0x08: // ACK
          break;
        case 0x0b: // PONG
          this.handlePong();
          break;
        case 0x0f: // CONFIG_ACK
          this.handleConfigAck(data);
          break;
      }
    }
  }

  private handleAuthOk(data: Buffer) {
    const sessionIdLength = data.readUInt16BE(1);
    this.sessionId = data.slice(3, 3 + sessionIdLength).toString();
    this.sendConfigRequest();
  }

  private handleStartTripOk(data: Buffer) {
    const tripIdLength = data.readUInt16BE(1);
    this.tripId = data.slice(3, 3 + tripIdLength).toString();
  }

  private handleConfigAck(data: Buffer) {
    this.n1 = data.readUInt16BE(1);
    this.t1 = data.readUInt16BE(3);
    this.t2 = data.readUInt16BE(5);
  }

  private sendConfigRequest() {
    const header = Buffer.alloc(1);
    header.writeUInt8(0x0e, 0);
    this.socket?.send(header);
  }

  startTrip() {
    const header = Buffer.alloc(1);
    header.writeUInt8(0x02, 0);
    this.socket?.send(header);
  }

  pauseTrip() {
    const header = Buffer.alloc(1);
    header.writeUInt8(0x0c, 0);
    this.socket?.send(header);
    this.startPingInterval();
  }

  resumeTrip() {
    if (this.tripId) {
      const tripIdBuffer = Buffer.from(this.tripId);
      const header = Buffer.alloc(3);
      header.writeUInt8(0x04, 0);
      header.writeUInt16BE(tripIdBuffer.length, 1);
      const resumeRequest = Buffer.concat([header, tripIdBuffer]);
      this.socket?.send(resumeRequest);
      this.clearPingInterval();
    }
  }

  endTrip() {
    const header = Buffer.alloc(1);
    header.writeUInt8(0x06, 0);
    this.socket?.send(header);
  }

  sendDataFrames(frames: Buffer[]) {
    const numFrames = frames.length;
    const header = Buffer.alloc(1);
    header.writeUInt8(0x01 | (numFrames << 2), 0);
    const message = Buffer.concat([header, ...frames]);
    this.socket?.send(message);
  }

  private startPingInterval() {
    this.pingInterval = setInterval(() => {
      const header = Buffer.alloc(1);
      header.writeUInt8(0x0a, 0);
      this.socket?.send(header);
      this.pingTimeout = setTimeout(() => {
        this.socket?.disconnect();
        this.connect();
      }, this.t2 * 1000);
    }, this.t1 * 1000);
  }

  private clearPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handlePong() {
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout);
      this.pingTimeout = null;
    }
  }

  disconnect() {
    this.socket?.disconnect();
  }
}

export const webSocketService = new WebSocketService();