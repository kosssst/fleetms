/* eslint-disable no-bitwise */

import { Buffer } from 'buffer';
import appConfig from '../config/config';

type SocketStatus = 'connected' | 'disconnected' | 'connecting';
type LogCallback = (message: string) => void;

const commandMap: { [key: number]: string } = {
  0x00: 'AUTH_REQ', 0x01: 'AUTH_OK', 0x02: 'START_TRIP_REQ', 0x03: 'START_TRIP_OK',
  0x04: 'RESUME_TRIP_REQ', 0x05: 'RESUME_TRIP_OK', 0x06: 'END_TRIP_REQ', 0x07: 'END_TRIP_OK',
  0x08: 'ACK', 0x09: 'ERROR', 0x0a: 'PING', 0x0b: 'PONG',
  0x0c: 'PAUSE_TRIP_REQ', 0x0d: 'PAUSE_TRIP_OK', 0x0e: 'CONFIG_REQ', 0x0f: 'CONFIG_ACK',
};

const getFrameType = (header: number) => (header >> 7) & 0x01;

const parseMessage = (data: Buffer): string => {
  const header = data.readUInt8(0);
  const commandName = commandMap[header];

  if (commandName) {
    return `CONTROL: ${commandName}`;
  } else {
    if (getFrameType(header) === 1) {
      const numFrames = header & 0x3F;
      return `DATA: ${numFrames} frames`;
    }
    return 'UNKNOWN';
  }
};

class WebSocketService {
  private socket: WebSocket | null = null;
  private tripId: string | null = null;
  private sessionId: string | null = null;
  private n1: number = 1;
  private t1: number = 10;
  private t2: number = 20;
  private inactivityTimer: any = null;
  private pongTimeout: any = null;
  private status: SocketStatus = 'disconnected';
  private isIntentionalDisconnect: boolean = false;
  private log: LogCallback = () => {};
  private lastToken: string | null = null;
  private offlineQueue: Buffer[] = [];
  private tripReady: boolean = false;

  private resetInactivityTimer() {
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
    if (!this.isConnected()) {
      return;
    }
    this.inactivityTimer = setTimeout(() => {
      this.sendPing();
    }, this.t1 * 1000);
  }

  private sendPing() {
    const header = Buffer.alloc(1);
    header.writeUInt8(0x0a, 0); // PING command
    this.sendMessage(header);
    this.pongTimeout = setTimeout(() => {
      this.log('Socket: PONG timeout. Reconnecting...');
      this.socket?.close();
    }, this.t2 * 1000);
  }

  connect(logCallback?: LogCallback) {
    if (logCallback) {
      this.log = logCallback;
    }

    // If we're already connecting/connected, do NOT touch tripReady.
    if (this.socket && (this.status === 'connecting' || this.status === 'connected')) {
      return;
    }

    // Only reset when we truly begin a new connection
    this.tripReady = false;              // <--- moved here

    if (!appConfig.WEBSOCKET_URL) {
      this.log('Socket: WebSocket URL is not configured.');
      return;
    }
    this.isIntentionalDisconnect = false;
    this.status = 'connecting';
    this.log('Socket: Connecting...');
    this.socket = new WebSocket(appConfig.WEBSOCKET_URL);
    this.socket.binaryType = 'arraybuffer';

    this.socket.onopen = () => {
      this.status = 'connected';
      this.log('Socket: Connection established.');
      this.resetInactivityTimer();
      if (this.lastToken) {
        this.log('Socket: Re-authenticating on connect...');
        this.authenticate(this.lastToken);
      }
    };

    this.socket.onclose = () => {
      this.status = 'disconnected';
      this.log('Socket: Disconnected.');
      clearTimeout(this.inactivityTimer);
      clearTimeout(this.pongTimeout);
      if (!this.isIntentionalDisconnect) {
        setTimeout(() => this.connect(), 5000);
      }
    };

    this.socket.onerror = (error) => {
      this.log(`Socket: Error - ${JSON.stringify(error)}`);
      console.error('WebSocket error:', error);
      this.socket?.close();
    };

    this.socket.onmessage = (event) => {
      this.resetInactivityTimer();
      const data = Buffer.from(event.data);
      this.log(`⬇️ RECV: ${parseMessage(data.slice(0, 1))} | ${data.toString('hex')}`);
      this.handleMessage(data);
    };
  }

  private sendMessage(data: Buffer) {
    if (this.isConnected()) {
      this.resetInactivityTimer();
      this.log(`⬆️ SEND: ${parseMessage(data.slice(0, 1))} | ${data.toString('hex')}`);
      this.socket?.send(data);
    } else {
      this.log(`Socket: Cannot send, not connected. Message: ${data.toString('hex')}`);
      if (getFrameType(data.readUInt8(0)) === 1) {
        this.offlineQueue.push(data);
      }
    }
  }

  getStatus(): SocketStatus {
    return this.status;
  }

  isConnected(): boolean {
    return this.status === 'connected';
  }

  getTripId(): string | null {
    return this.tripId;
  }

  setTripId(tripId: string) {
    this.tripId = tripId;
  }

  authenticate(token: string) {
    this.lastToken = token;
    if (token && this.isConnected()) {
      const tokenBuffer = Buffer.from(token);
      const header = Buffer.alloc(3);
      header.writeUInt8(0x00, 0);
      header.writeUInt16BE(tokenBuffer.length, 1);
      const authRequest = Buffer.concat([header, tokenBuffer]);
      this.sendMessage(authRequest);
    }
  }

  private handleMessage(data: Buffer) {
    const header = data.readUInt8(0);
    const commandName = commandMap[header];

    if (commandName) {
      switch (header) {
        case 0x01: // AUTH_OK
          this.handleAuthOk(data);
          break;
        case 0x03: // START_TRIP_OK
          this.handleStartTripOk(data);
          break;
        case 0x05: // RESUME_TRIP_OK
          this.handleResumeTripOk();
          this.log('Socket: Trip resumed successfully.');
          break;
        case 0x07: // END_TRIP_OK
          this.tripReady = false;
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

    // If we had a trip, resume it — but DO NOT flush data yet.
    if (this.tripId) {
      this.resumeTrip();
    }
    // ❌ DO NOT call sendOfflineData() here.
  }

  private handleStartTripOk(data: Buffer) {
    const tripIdLength = data.readUInt16BE(1);
    this.tripId = data.slice(3, 3 + tripIdLength).toString('hex');
    this.tripReady = true;            // <--- NEW
    this.sendOfflineData();           // <--- NOW safe to flush
  }

  private handleResumeTripOk() {
    this.tripReady = true;            // <--- NEW
    this.log('Socket: Trip resumed successfully.');
    this.sendOfflineData();           // <--- NOW safe to flush
  }

  private handleConfigAck(data: Buffer) {
    this.n1 = data.readUInt16BE(1);
    this.t1 = data.readUInt16BE(3);
    this.t2 = data.readUInt16BE(5);
    this.log(`Socket: Configured with t1=${this.t1}s, t2=${this.t2}s`);
    this.resetInactivityTimer(); // Re-start timer with new values
  }

  private sendConfigRequest() {
    const header = Buffer.alloc(1);
    header.writeUInt8(0x0e, 0);
    this.sendMessage(header);
  }

  startTrip() {
    this.tripReady = false;
    const header = Buffer.alloc(1);
    header.writeUInt8(0x02, 0);
    this.sendMessage(header);
  }

  pauseTrip() {
    const header = Buffer.alloc(1);
    header.writeUInt8(0x0c, 0);
    this.sendMessage(header);
  }

  resumeTrip() {
    if (this.tripId) {
      const tripIdBuffer = Buffer.from(this.tripId, 'hex');
      const header = Buffer.alloc(3);
      header.writeUInt8(0x04, 0);
      header.writeUInt16BE(tripIdBuffer.length, 1);
      const resumeRequest = Buffer.concat([header, tripIdBuffer]);
      this.sendMessage(resumeRequest);
    }
  }

  endTrip() {
    this.tripReady = false;
    const header = Buffer.alloc(1);
    header.writeUInt8(0x06, 0);
    this.sendMessage(header);
  }

  sendDataFrames(frames: Buffer[]) {
    // If not connected or trip not ready, just queue
    if (!this.isConnected() || !this.tripReady) {
      this.log(`Socket: not ready (${this.isConnected()?'conn':'disc'}/${this.tripReady?'ready':'not-ready'}). Queuing ${frames.length} frames.`);
      this.offlineQueue.push(...frames);
      return;
    }

    const numFrames = frames.length;
    if (numFrames === 0 || numFrames > 63) {
      this.log('Socket: Invalid number of data frames to send.');
      return;
    }
    const header = Buffer.alloc(1);
    header.writeUInt8((1 << 7) | (numFrames & 0x3F), 0);
    const message = Buffer.concat([header, ...frames]);
    this.sendMessage(message);
  }


  private sendOfflineData() {
    if (!this.tripReady || !this.isConnected()) return; // <--- NEW guard
    if (this.offlineQueue.length === 0) return;

    this.log(`Socket: Sending ${this.offlineQueue.length} offline frames.`);
    const framesToSend = [...this.offlineQueue];
    this.offlineQueue = [];

    while (framesToSend.length > 0) {
      const chunk = framesToSend.splice(0, 63);
      this.sendDataFrames(chunk);
    }
  }

  private handlePong() {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    this.tripReady = false;
    this.socket?.close();
  }
}

export const webSocketService = new WebSocketService();