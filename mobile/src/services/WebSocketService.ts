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

const bufferToSpacedHex = (buffer: Buffer) => {
  return buffer.toString('hex').match(/.{1,2}/g)?.join(' ').toUpperCase() || '';
};

// Error Codes for ERROR frame
const ErrorCode = {
  AUTH_FAILED: 0x01,
  INVALID_TRIP: 0x02,
};

// --- Helper Functions ---
/* eslint-disable no-bitwise */
const createDataHeader = (recordCount: number) => (FrameType.DATA << 7) | (recordCount & 0x3F);
const getFrameType = (header: number) => (header >> 7) & 0x01;
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
  private reconnectTimer: number | null = null;

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
    this.clearPingTimers();
    this.sendMessage(Buffer.from([CommandType.START_TRIP_REQ]));
  }

  resumeTrip(tripId: string) {
    this.clearPingTimers();
    this.tripId = tripId;
    const tripIdBytes = Buffer.from(tripId, 'hex');
    const buffer = Buffer.alloc(3 + tripIdBytes.length);
    buffer.writeUInt8(CommandType.RESUME_TRIP_REQ, 0);
    buffer.writeUInt16BE(tripIdBytes.length, 1);
    tripIdBytes.copy(buffer, 3);
    this.sendMessage(buffer);
  }

  pauseTrip() {
    this.sendMessage(Buffer.from([CommandType.PAUSE_TRIP_REQ]));
    this.startPing();
  }

  endTrip() {
    this.sendMessage(Buffer.from([CommandType.END_TRIP_REQ]));
    this.clearAllTimers();
    this.tripId = null;
    this.startPing();
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
    this.startPing();
    const data = Buffer.from(event.data as ArrayBuffer);
    console.log(`[RECV RAW] ${bufferToSpacedHex(data)}`);
    const header = data.readUInt8(0);
    const frameType = getFrameType(header);

    if (frameType === FrameType.CONTROL) {
      const commandType = header; // For CONTROL frames, the header IS the command
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
    this.reconnect();
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
        const payloadLength = data.readUInt16BE(1);
        if (payloadLength === 6) {
            this.n1 = data.readUInt16BE(3);
            this.t1 = data.readUInt16BE(5);
            this.t2 = data.readUInt16BE(7);
            this.log(` -> Config received: n1=${this.n1}, t1=${this.t1}, t2=${this.t2}`);
            this.startPing();
            if (this.isReconnecting && this.tripId) {
              this.resumeTrip(this.tripId);
            }
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
      this.startPing();
      if (isControl) {
        const commandType = buffer.readUInt8(0);
        this.log(`Sending CONTROL: ${getCommandName(commandType)}`);
      } else {
        // eslint-disable-next-line no-bitwise
        const recordCount = buffer.readUInt8(0) & 0x3F;
        this.log(`Sending DATA with ${recordCount} records.`);
      }
      console.log(`[SEND RAW] ${bufferToSpacedHex(buffer)}`);
      this.ws.send(buffer);
    } else {
      this.log('Error: WebSocket is not connected.');
    }
  }

  private authenticate() {
    if (!this.token) return;
    const tokenBytes = Buffer.from(this.token, 'utf-8');
    const buffer = Buffer.alloc(3 + tokenBytes.length);
    buffer.writeUInt8(CommandType.AUTH_REQ, 0);
    buffer.writeUInt16BE(tokenBytes.length, 1);
    tokenBytes.copy(buffer, 3);
    this.sendMessage(buffer);
  }

  private requestConfig() {
    this.sendMessage(Buffer.from([CommandType.CONFIG_REQ]));
  }

  private sendOfflineBuffer() {
    if (this.dataFrameBuffer.length > 0) {
      this.log(`Sending ${this.dataFrameBuffer.length} buffered data frames...`);
      const framesToSend = [...this.dataFrameBuffer];
      this.dataFrameBuffer = [];
      const chunkSize = 60;
      for (let i = 0; i < framesToSend.length; i += chunkSize) {
        const chunk = framesToSend.slice(i, i + chunkSize);
        this.sendDataFrames(chunk);
      }
    }
  }

  private reconnect() {
    if (this.reconnectTimer || this.status === 'connecting' || this.status === 'connected') {
      return;
    }
    this.disconnect();
    if (this.token) {
      this.reconnectTimer = BackgroundTimer.setTimeout(() => {
        this.log('Attempting to reconnect...');
        this.reconnectTimer = null;
        this.connect(this.token!);
      }, 5000);
    }
  }

  // --- Timers ---
  private startPing() {
    this.clearPingTimers();
    const pingInterval = this.t1 * 1000;
    if (pingInterval <= 0) {
        return;
    }
    this.pingIntervalId = BackgroundTimer.setInterval(() => {
      this.sendMessage(Buffer.from([CommandType.PING]));
      this.pingTimeoutId = BackgroundTimer.setTimeout(() => {
        this.log('Ping timeout! Server not responding.');
        this.reconnect();
      }, this.t2 * 1000);
    }, pingInterval);
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
      this.reconnect();
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
    if (this.reconnectTimer) {
      BackgroundTimer.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const webSocketService = new WebSocketService();
