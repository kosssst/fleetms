import { Buffer } from 'buffer';
import BackgroundTimer from 'react-native-background-timer';
import config from '../config/config';

// Protocol Command Types from Header bits 2-7
const CommandType = {
  AUTH_REQ: 0x00,
  AUTH_OK: 0x01,
  START_TRIP_REQ: 0x02,
  START_TRIP_OK: 0x03,
  RESUME_TRIP_REQ: 0x04,
  RESUME_TRIP_OK: 0x05,
  END_TRIP_REQ: 0x06,
  END_TRIP_OK: 0x07,
  ACK: 0x08,
  ERROR: 0x09,
  PING: 0x0A,
  PONG: 0x0B,
  PAUSE_TRIP_REQ: 0x0C,
  PAUSE_TRIP_OK: 0x0D,
  CONFIG_REQ: 0x0E,
  CONFIG_ACK: 0x0F,
};

// Helper to get the string name of a command type
const getCommandName = (value: number) => {
  const entry = Object.entries(CommandType).find(([_, val]) => val === value);
  return entry ? entry[0] : `UNKNOWN (0x${value.toString(16)})`;
};


type SocketStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

class WebSocketService {
  private ws: WebSocket | null = null;
  private status: SocketStatus = 'disconnected';
  private token: string | null = null;
  private pingIntervalId: number | null = null;
  private pingTimeoutId: number | null = null;

  // Configuration from server
  private n1: number = 10; // Default ACK threshold
  private t1: number = 30; // Default ping interval (seconds)
  private t2: number = 10; // Default ping timeout (seconds)

  // Callbacks
  public onStatusChange: (status: SocketStatus) => void = () => {};
  public onTripIdReceived: (tripId: string) => void = () => {};
  public onAuthOk: () => void = () => {};
  public onLog: (message: string) => void = () => {};

  private getCommandType(header: number): number {
    return (header >> 2) & 0x3F;
  }

  connect(token: string) {
    if (this.ws) {
      this.disconnect();
    }
    this.onLog('WebSocket: Attempting to connect...');
    this.token = token;
    this.status = 'connecting';
    this.onStatusChange(this.status);

    const url = `${config.WEBSOCKET_URL}?token=${this.token}`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.onLog('WebSocket: Connection opened successfully.');
      this.status = 'connected';
      this.onStatusChange(this.status);
      this.authenticate();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(Buffer.from(event.data));
    };

    this.ws.onerror = (error) => {
      this.onLog(`WebSocket Error: ${error.message}`);
      this.status = 'error';
      this.onStatusChange(this.status);
      // this.reconnect(); // Temporarily disabled for manual debugging
    };

    this.ws.onclose = (event) => {
      this.onLog(`WebSocket: Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      this.status = 'disconnected';
      this.onStatusChange(this.status);
      this.clearTimers();
      // Implement reconnection logic if needed
    };
  }

  disconnect() {
    this.onLog('WebSocket: Disconnecting...');
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = 'disconnected';
    this.onStatusChange(this.status);
  }

  private reconnect() {
    this.disconnect();
    if (this.token) {
      BackgroundTimer.setTimeout(() => {
        this.connect(this.token!);
      }, 5000); // 5-second reconnect delay
    }
  }

  private handleMessage(data: Buffer) {
    const header = data.readUInt8(0);
    const frameType = (header >> 7) & 0x01;

    if (frameType === 0) { // CONTROL Frame
      const commandType = this.getCommandType(header);
      this.onLog(`Received CONTROL: ${getCommandName(commandType)}`);

      switch (commandType) {
        case CommandType.AUTH_OK:
          this.onAuthOk();
          this.requestConfig();
          break;
        case CommandType.CONFIG_ACK:
          this.n1 = data.readUInt16BE(1);
          this.t1 = data.readUInt16BE(3);
          this.t2 = data.readUInt16BE(5);
          this.onLog(` -> Config received: n1=${this.n1}, t1=${this.t1}, t2=${this.t2}`);
          break;
        case CommandType.START_TRIP_OK:
        case CommandType.RESUME_TRIP_OK:
          const tripIdLength = data.readUInt16BE(1);
          const tripId = data.slice(3, 3 + tripIdLength).toString('hex');
          this.onLog(` -> Trip ID: ${tripId}`);
          this.onTripIdReceived(tripId);
          break;
        case CommandType.PONG:
          this.handlePong();
          break;
        // Handle other commands like ACK, ERROR etc.
      }
    } else { // DATA Frame
        const recordCount = header & 0x3F;
        this.onLog(`Received DATA with ${recordCount} records.`);
    }
  }

  private sendMessage(buffer: Buffer, isControl: boolean = true) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (isControl) {
        const commandType = this.getCommandType(buffer.readUInt8(0));
        this.onLog(`Sending CONTROL: ${getCommandName(commandType)}`);
      } else {
        const recordCount = buffer.readUInt8(0) & 0x3F;
        this.onLog(`Sending DATA with ${recordCount} records.`);
      }
      this.ws.send(buffer);
    } else {
      this.onLog('Error: WebSocket is not connected.');
    }
  }

  authenticate() {
    if (!this.token) return;
    const tokenBytes = Buffer.from(this.token, 'utf-8');
    const buffer = Buffer.alloc(3 + tokenBytes.length);
    buffer.writeUInt8(CommandType.AUTH_REQ, 0);
    buffer.writeUInt16BE(tokenBytes.length, 1);
    tokenBytes.copy(buffer, 3);
    this.sendMessage(buffer);
  }

  requestConfig() {
    const buffer = Buffer.from([CommandType.CONFIG_REQ]);
    this.sendMessage(buffer);
  }

  startTrip() {
    const buffer = Buffer.from([CommandType.START_TRIP_REQ]);
    this.sendMessage(buffer);
  }

  resumeTrip(tripId: string) {
    const tripIdBytes = Buffer.from(tripId, 'hex');
    const buffer = Buffer.alloc(3 + tripIdBytes.length);
    buffer.writeUInt8(CommandType.RESUME_TRIP_REQ, 0);
    buffer.writeUInt16BE(tripIdBytes.length, 1);
    tripIdBytes.copy(buffer, 3);
    this.sendMessage(buffer);
  }

  pauseTrip() {
    const buffer = Buffer.from([CommandType.PAUSE_TRIP_REQ]);
    this.sendMessage(buffer);
    this.startPing();
  }

  endTrip() {
    const buffer = Buffer.from([CommandType.END_TRIP_REQ]);
    this.sendMessage(buffer);
    this.clearTimers();
  }

  sendDataFrames(frames: Buffer[]) {
    const header = (1 << 7) | (frames.length & 0x3F);
    const message = Buffer.concat([Buffer.from([header]), ...frames]);
    this.sendMessage(message, false);
  }

  private startPing() {
    this.clearTimers();
    this.pingIntervalId = BackgroundTimer.setInterval(() => {
      const buffer = Buffer.from([CommandType.PING]);
      this.sendMessage(buffer);
      this.pingTimeoutId = BackgroundTimer.setTimeout(() => {
        this.reconnect();
      }, this.t2 * 1000);
    }, this.t1 * 1000);
  }

  private handlePong() {
    if (this.pingTimeoutId) {
      BackgroundTimer.clearTimeout(this.pingTimeoutId);
      this.pingTimeoutId = null;
    }
  }

  private clearTimers() {
    if (this.pingIntervalId) {
      BackgroundTimer.clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
    if (this.pingTimeoutId) {
      BackgroundTimer.clearTimeout(this.pingTimeoutId);
      this.pingTimeoutId = null;
    }
  }
}

export const webSocketService = new WebSocketService();
