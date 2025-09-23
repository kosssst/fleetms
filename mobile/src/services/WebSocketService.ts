import { Buffer } from 'buffer';
import BackgroundTimer from 'react-native-background-timer';
import config from '../config/config';

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
  const entry = Object.entries(CommandType).find(([_, val]: [string, number]) => val === value);
  return entry ? entry[0] : `UNKNOWN(0x${value.toString(16)})`;
};

// Error Codes for ERROR frame
const ErrorCode = {
  AUTH_FAILED: 0x01,
  INVALID_TRIP: 0x02,
};

// --- Helper Functions ---
/* eslint-disable no-bitwise */
const createControlHeader = (command: number) => (FrameType.CONTROL << 7) | (command << 2);
const createDataHeader = (recordCount: number) => (FrameType.DATA << 7) | (recordCount & 0x3F);
const getCommandType = (header: number) => (header >> 2) & 0x3F;
/* eslint-enable no-bitwise */

type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

class WebSocketService {
  private ws: WebSocket | null = null;
  private status: SocketStatus = 'disconnected';
  private token: string | null = null;
  private tripId: string | null = null;
  private isReconnecting = false;

  // Timers
  private pingIntervalId: number | null = null;
  private pingTimeoutId: number | null = null;
  private ackTimeoutId: number | null = null;

  // Protocol Config
  private n1: number = 10; // ACK threshold
  private t1: number = 30; // Ping interval (s)
  private t2: number = 10; // Ping timeout (s)
  private ackTimeoutDuration: number = 5000; // 5s for ACK response

  // Buffering & ACK
  private dataFrameBuffer: Buffer[] = [];
  private sentFramesWaitingForAck: number = 0;

  // Callbacks
  public onStatusChange: (status: SocketStatus) => void = () => {};
  public onTripIdReceived: (tripId: string) => void = () => {};
  public onLog: (message: string) => void = () => {};
  public onAuthError: () => void = () => {};

  private log(message: string) {
    console.log(message); // Log to devtools console
    this.onLog(message);   // Log to in-app scroll view
  }

  // --- Public Methods ---
  connect(token: string) {
    if (this.ws) this.disconnect();
    this.log('WebSocket: Attempting to connect...');
    this.token = token;
    this.status = 'connecting';
    this.onStatusChange(this.status);

    this.ws = new WebSocket(`${config.WEBSOCKET_URL}?token=${this.token}`);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onerror = this.onError.bind(this);
    this.ws.onclose = this.onClose.bind(this);
  }

  disconnect() {
    this.log('WebSocket: Disconnecting...');
    this.clearAllTimers();
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.status = 'disconnected';
    this.onStatusChange(this.status);
  }

  startTrip() {
    const header = createControlHeader(CommandType.START_TRIP_REQ);
    this.sendMessage(Buffer.from([header]));
  }

  resumeTrip(tripId: string) {
    this.tripId = tripId;
    const tripIdBytes = Buffer.from(tripId, 'hex');
    const buffer = Buffer.alloc(3 + tripIdBytes.length);
    const header = createControlHeader(CommandType.RESUME_TRIP_REQ);
    buffer.writeUInt8(header, 0);
    buffer.writeUInt16BE(tripIdBytes.length, 1);
    tripIdBytes.copy(buffer, 3);
    this.sendMessage(buffer);
  }

  pauseTrip() {
    const header = createControlHeader(CommandType.PAUSE_TRIP_REQ);
    this.sendMessage(Buffer.from([header]));
    this.startPing();
  }

  endTrip() {
    const header = createControlHeader(CommandType.END_TRIP_REQ);
    this.sendMessage(Buffer.from([header]));
    this.clearAllTimers();
    this.tripId = null;
  }

  sendDataFrames(frames: Buffer[]) {
    if (this.status !== 'connected') {
      this.log(`Buffering ${frames.length} data frame(s) while disconnected.`);
      this.dataFrameBuffer.push(...frames);
      return;
    }
    const header = createDataHeader(frames.length);
    const message = Buffer.concat([Buffer.from([header]), ...frames]);
    this.sendMessage(message, false);
    this.sentFramesWaitingForAck += frames.length;
    if (this.sentFramesWaitingForAck >= this.n1) {
      this.startAckTimer();
    }
  }

  // --- WebSocket Event Handlers ---
  private onOpen() {
    this.log('WebSocket: Connection opened successfully.');
    this.status = 'connected';
    this.onStatusChange(this.status);
    this.authenticate();
  }

  private onMessage(event: MessageEvent) {
    const data = Buffer.from(event.data as ArrayBuffer);
    const header = data.readUInt8(0);
    // eslint-disable-next-line no-bitwise
    const frameType = (header >> 7) & 0x01;

    if (frameType === FrameType.CONTROL) {
      const commandType = getCommandType(header);
      this.log(`Received CONTROL: ${getCommandName(commandType)}`);
      this.handleControlMessage(commandType, data);
    } else {
      // eslint-disable-next-line no-bitwise
      const recordCount = header & 0x3F;
      this.log(`Received DATA with ${recordCount} records.`);
    }
  }

  private onError(error: Event) {
    this.log(`WebSocket Error: ${(error as any).message || 'Unknown error'}`);
    this.status = 'error';
    this.onStatusChange(this.status);
    // Reconnection is disabled for manual debugging
  }

  private onClose(event: CloseEvent) {
    this.log(`WebSocket: Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
    this.status = 'disconnected';
    this.onStatusChange(this.status);
    this.clearAllTimers();
  }

  // --- Protocol Logic ---
  private handleControlMessage(commandType: number, data: Buffer) {
    switch (commandType) {
      case CommandType.AUTH_OK:
        this.requestConfig();
        break;
      case CommandType.CONFIG_ACK:
        this.n1 = data.readUInt16BE(1);
        this.t1 = data.readUInt16BE(3);
        this.t2 = data.readUInt16BE(5);
        this.log(` -> Config received: n1=${this.n1}, t1=${this.t1}, t2=${this.t2}`);
        if (this.isReconnecting && this.tripId) {
          this.resumeTrip(this.tripId);
        }
        break;
      case CommandType.START_TRIP_OK:
        const tripIdLength = data.readUInt16BE(1);
        this.tripId = data.slice(3, 3 + tripIdLength).toString('hex');
        this.log(` -> Trip ID: ${this.tripId}`);
        this.onTripIdReceived(this.tripId);
        break;
      case CommandType.RESUME_TRIP_OK:
        this.isReconnecting = false;
        this.log(' -> Trip resumed successfully.');
        this.sendOfflineBuffer();
        break;
      case CommandType.ACK:
        this.log(` -> ACK received. Resetting counter.`);
        this.sentFramesWaitingForAck = 0;
        this.clearAckTimer();
        break;
      case CommandType.PONG:
        this.handlePong();
        break;
      case CommandType.ERROR:
        const errorCode = data.readUInt8(1);
        const messageLength = data.readUInt16BE(2);
        const errorMessage = data.slice(4, 4 + messageLength).toString('utf-8');
        this.log(` -> Error received with code ${errorCode}: ${errorMessage}`);
        if (errorCode === ErrorCode.AUTH_FAILED) {
          this.onAuthError();
        }
        break;
    }
  }

  private sendMessage(buffer: Buffer, isControl: boolean = true) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (isControl) {
        const commandType = getCommandType(buffer.readUInt8(0));
        this.log(`Sending CONTROL: ${getCommandName(commandType)}`);
      } else {
        // eslint-disable-next-line no-bitwise
        const recordCount = buffer.readUInt8(0) & 0x3F;
        this.log(`Sending DATA with ${recordCount} records.`);
      }
      this.ws.send(buffer);
    } else {
      this.log('Error: WebSocket is not connected.');
    }
  }

  private authenticate() {
    if (!this.token) return;
    const tokenBytes = Buffer.from(this.token, 'utf-8');
    const buffer = Buffer.alloc(3 + tokenBytes.length);
    const header = createControlHeader(CommandType.AUTH_REQ);
    buffer.writeUInt8(header, 0);
    buffer.writeUInt16BE(tokenBytes.length, 1);
    tokenBytes.copy(buffer, 3);
    this.sendMessage(buffer);
  }

  private requestConfig() {
    const header = createControlHeader(CommandType.CONFIG_REQ);
    this.sendMessage(Buffer.from([header]));
  }

  private sendOfflineBuffer() {
    if (this.dataFrameBuffer.length > 0) {
      this.log(`Sending ${this.dataFrameBuffer.length} buffered data frames...`);
      const framesToSend = [...this.dataFrameBuffer];
      this.dataFrameBuffer = [];
      // Send in chunks to avoid large single messages
      const chunkSize = 60;
      for (let i = 0; i < framesToSend.length; i += chunkSize) {
        const chunk = framesToSend.slice(i, i + chunkSize);
        this.sendDataFrames(chunk);
      }
    }
  }

  // --- Timers ---
  private startPing() {
    this.clearPingTimers();
    this.pingIntervalId = BackgroundTimer.setInterval(() => {
      const header = createControlHeader(CommandType.PING);
      this.sendMessage(Buffer.from([header]));
      this.pingTimeoutId = BackgroundTimer.setTimeout(() => {
        this.log('Ping timeout! Server not responding.');
        this.disconnect(); // Or trigger reconnect
      }, this.t2 * 1000);
    }, this.t1 * 1000);
  }

  private handlePong() {
    if (this.pingTimeoutId) {
      BackgroundTimer.clearTimeout(this.pingTimeoutId);
      this.pingTimeoutId = null;
    }
  }

  private startAckTimer() {
    this.clearAckTimer();
    this.ackTimeoutId = BackgroundTimer.setTimeout(() => {
      this.log('ACK timeout! Server did not acknowledge data.');
      this.disconnect(); // Or trigger reconnect
    }, this.ackTimeoutDuration);
  }

  private clearPingTimers() {
    if (this.pingIntervalId) BackgroundTimer.clearInterval(this.pingIntervalId);
    if (this.pingTimeoutId) BackgroundTimer.clearTimeout(this.pingTimeoutId);
    this.pingIntervalId = null;
    this.pingTimeoutId = null;
  }

  private clearAckTimer() {
    if (this.ackTimeoutId) BackgroundTimer.clearTimeout(this.ackTimeoutId);
    this.ackTimeoutId = null;
  }

  private clearAllTimers() {
    this.clearPingTimers();
    this.clearAckTimer();
  }
}

export const webSocketService = new WebSocketService();