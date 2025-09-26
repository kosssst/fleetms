import RNBluetoothClassic,
{
  BluetoothDevice,
} from 'react-native-bluetooth-classic';
import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  acceleratorPositionDecoder,
  engineSpeedDecoder,
  fuelPerStrokeDecoder,
  temperatureDecoder,
  vehicleSpeedDecoder,
} from '../utils/decoders';
import { obdParameters, ObdParameter } from '../config/obd-parameters';

// --- Constants from obd_csv.py ---
const UPDATE_CODE = '3E01';
const READ_TIMEOUT_PRIMARY = 0.65;
const READ_TIMEOUT_RETRY = 0.9;
const KEEPALIVE_PERIOD = 1.8;
const SAMPLE_PERIOD_SEC = 0.6;

// --- Type definitions ---
type StatusCallback = (
  status: 'disconnected' | 'searching' | 'connected' | 'error',
) => void;
type DeviceCallback = (device: BluetoothDevice | null) => void;
type LogCallback = (message: string) => void;

const decoders: { [key: string]: (payload: Buffer) => number } = {
  vehicleSpeedDecoder,
  engineSpeedDecoder,
  acceleratorPositionDecoder,
  temperatureDecoder,
  fuelPerStrokeDecoder,
};

interface CommandMap {
  [command: string]: ObdParameter[];
}

interface MinLenMap {
  [command: string]: number;
}

// --- OBDService Class ---
class OBDService {
  private device: BluetoothDevice | null = null;
  private pollingInterval: any = null;
  private isTripActive: boolean = false;
  private isSearching: boolean = false;
  private keepAliveTimer: any = null;

  private commandsMap: CommandMap = {};
  private headersOrder: string[] = [];
  private minLenNeeded: MinLenMap = {};

  constructor() {
    this.loadCommandTable();
  }

  private loadCommandTable() {
    const headers: string[] = [];
    const seenHeaders = new Set<string>();

    obdParameters.forEach(p => {
      if (!seenHeaders.has(p.header)) {
        headers.push(p.header);
        seenHeaders.add(p.header);
      }

      if (!this.commandsMap[p.command]) {
        this.commandsMap[p.command] = [];
      }
      this.commandsMap[p.command].push(p);

      const nbytes = Math.max(1, p.numBits / 8);
      const needed = p.startByte - 1 + nbytes;
      const prev = this.minLenNeeded[p.command] || 0;
      this.minLenNeeded[p.command] = Math.max(prev, needed);
    });

    this.headersOrder = headers;
  }

  async requestPermissions(onLog: LogCallback): Promise<boolean> {
    if (Platform.OS === 'ios') return true;
    const granted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    const allPermissionsGranted =
      granted['android.permission.BLUETOOTH_SCAN'] === 'granted' &&
      granted['android.permission.BLUETOOTH_CONNECT'] === 'granted';
    if (allPermissionsGranted) {
      onLog('Bluetooth permissions granted.');
      return true;
    } else {
      onLog('Bluetooth permissions denied.');
      return false;
    }
  }

  async startSearch(
    onStatusChange: StatusCallback,
    onDeviceFound: DeviceCallback,
    onLog: LogCallback,
  ) {
    this.isSearching = true;
    onStatusChange('searching');
    onLog('Starting search for paired ELM327 devices...');
    try {
      const pairedDevices = await RNBluetoothClassic.getBondedDevices();
      if (pairedDevices.length === 0) {
        onLog('No paired devices found.');
        onStatusChange('error');
        this.isSearching = false;
        return;
      }
      onLog(`Found ${pairedDevices.length} paired devices. Interrogating...`);
      for (const device of pairedDevices) {
        if (!this.isSearching) {
          onLog('Search was stopped.');
          break;
        }
        onLog(`Attempting to interrogate ${device.name} (${device.address})`);
        try {
          const connectedDevice = await this.interrogateDevice(device, onLog);
          if (connectedDevice) {
            onLog(`ELM327 confirmed for device: ${connectedDevice.name}.`);
            this.device = connectedDevice;
            await this.initializeELM327(onLog);
            onDeviceFound(this.device);
            onStatusChange('connected');
            this.isSearching = false;
            return;
          }
        } catch (error: any) {
          onLog(`Failed during interrogation/initialization of ${device.name}: ${error.message}`);
          // If we had a connected device but failed during init, we must clean up.
          if (this.device) {
            this.clearKeepAlive();
            try {
              await this.device.disconnect();
            } catch (disconnectError) {
              onLog(`Error during cleanup disconnect: ${disconnectError}`);
            }
            this.device = null;
          }
        }
      }
      if (this.isSearching) {
        onLog('No ELM327 device found.');
        onStatusChange('disconnected');
      }
    } catch (error: any) {
      onLog(`Error getting paired devices: ${error.message}`);
      onStatusChange('error');
    } finally {
      this.isSearching = false;
    }
  }

  private async interrogateDevice(
    device: BluetoothDevice,
    onLog: LogCallback,
  ): Promise<BluetoothDevice | null> {
    let connectedDevice: BluetoothDevice | null = null;
    try {
      connectedDevice = await RNBluetoothClassic.connectToDevice(device.address, {
        delimiter: '>',           // IMPORTANT: frame responses by '>'
        charset: 'ascii',         // optional but good hygiene
      });
      onLog(`Connected to ${device.name}.`);
      await connectedDevice.write('ATI\r');
      const response = await this.readUntilDelimiter(connectedDevice);
      if (response.includes('ELM327')) {
        return connectedDevice;
      } else {
        await connectedDevice.disconnect();
        return null;
      }
    } catch (error) {
      if (connectedDevice) {
        try {
          await connectedDevice.disconnect();
        } catch (disconnectError) {
          onLog(`Error disconnecting after failed interrogation: ${disconnectError}`);
        }
      }
      throw error;
    }
  }

  async initializeELM327(onLog: LogCallback) {
    const initCommands = [
      'ATE0',
      'ATL0',
      'ATS0',
      'ATH0',
      'ATSP5',
      'ATDPN',
      'ATIIA 7A',
      'ATSH 81 7A F1',
      'ATST C8',
      'ATAT1',
      '81',
      '10C0',
      '3E01',
    ];
    for (const cmd of initCommands) {
      onLog(`Sending init command: ${cmd}`);
      await this.sendCommand(cmd);
    }
    onLog('Device initialization complete.');
    this.scheduleKeepAlive(); // Start the keep-alive timer
  }

  private scheduleKeepAlive() {
    this.clearKeepAlive();
    this.keepAliveTimer = setTimeout(() => {
      if (this.device) {
        console.log('Sending keep-alive command (3E01)');
        this.device.write(UPDATE_CODE + '\r').catch(err => {
          console.error('Failed to send keep-alive:', err);
        });
        this.scheduleKeepAlive();
      }
    }, KEEPALIVE_PERIOD * 1000);
  }

  private clearKeepAlive() {
    if (this.keepAliveTimer) {
      clearTimeout(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  async sendCommand(cmd: string, timeout?: number): Promise<string> {
    if (!this.device) throw new Error('Device not connected');
    this.clearKeepAlive();
    try {
      await this.device.clear();
      await this.device.write(cmd + '\r');
      return await this.readUntilDelimiter(this.device, timeout);
    } finally {
      this.scheduleKeepAlive();
    }
  }

  private readUntilDelimiter(device: BluetoothDevice, timeoutMs = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      let resolved = false;
      const t = setTimeout(() => {
        if (!resolved) {
          sub.remove();
          reject(new Error('Timeout waiting for prompt ">"'));
        }
      }, timeoutMs);

      const sub = device.onDataReceived(event => {
        // with delimiter mode, event.data already ends at '>'
        resolved = true;
        clearTimeout(t);
        sub.remove();
        resolve(event.data); // e.g. "ATI\rELM327 v1.5\r>"
      });
    });
  }

  private extractPayload(cmd: string, resp: string, minLen: number): Buffer | null {
    const wanted = '61' + cmd.substring(2);
    const hexOnly = resp.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const pos = hexOnly.indexOf(wanted);
    if (pos === -1) return null;
    const payloadHex = hexOnly.substring(pos + wanted.length);
    if (payloadHex.length / 2 < minLen) return null;
    return Buffer.from(payloadHex, 'hex');
  }

  private async pollCommand(cmd: string, minLen: number): Promise<Buffer | null> {
    try {
      let response = await this.sendCommand(cmd, READ_TIMEOUT_PRIMARY * 1000);
      let payload = this.extractPayload(cmd, response, minLen);
      if (payload) return payload;

      response = await this.sendCommand(cmd, READ_TIMEOUT_RETRY * 1000);
      return this.extractPayload(cmd, response, minLen);
    } catch (error) {
      console.error(`Error polling command ${cmd}:`, error);
      return null;
    }
  }

  private isPolling: boolean = false;

  startPolling(
    dataCallback: (data: any) => void,
    sendDataCallback: (data: Buffer) => void,
    numberOfCylinders: number,
  ) {
    if (this.isPolling) {
      return;
    }
    this.isPolling = true;
    this.poll(dataCallback, sendDataCallback, numberOfCylinders);
  }

  private async poll(
    dataCallback: (data: any) => void,
    sendDataCallback: (data: Buffer) => void,
    numberOfCylinders: number,
  ) {
    while (this.isPolling) {
      const loopStart = Date.now();

      if (this.device && this.isTripActive) {
        const allData: any = {};
        for (const cmd of Object.keys(this.commandsMap)) {
          if (!this.isPolling) break; // Exit early if polling was stopped

          const minLen = this.minLenNeeded[cmd] || 0;
          const payload = await this.pollCommand(cmd, minLen);
          if (!payload) continue;

          const params = this.commandsMap[cmd];
          for (const p of params) {
            const nbytes = Math.max(1, p.numBits / 8);
            const start = p.startByte - 1;
            if (start + nbytes > payload.length) continue;
            const field = payload.slice(start, start + nbytes);
            const decoder = decoders[p.decoder];
            if (decoder) allData[p.header] = decoder(field);
          }
        }

        if (this.isPolling) {
            allData.fuel_consumption_rate = (allData.fuel_per_stroke || 0) * numberOfCylinders;
            delete allData.fuel_per_stroke;

            dataCallback(allData);
            const dataFrame = this.createDataFrame(allData);
            sendDataCallback(dataFrame);
        }
      }

      const elapsed = Date.now() - loopStart;
      const delay = Math.max(0, SAMPLE_PERIOD_SEC * 1000 - elapsed);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  createDataFrame(data: any): Buffer {
    const frame = Buffer.alloc(32);
    const timestamp = Date.now();
    const high = Math.floor(timestamp / 4294967296);
    const low = timestamp % 4294967296;
    frame.writeUInt32BE(high, 0);
    frame.writeUInt32BE(low, 4);
    frame.writeInt32BE(0, 8);
    frame.writeInt32BE(0, 12);
    frame.writeInt32BE(0, 16);
    frame.writeUInt16BE(data.vehicle_speed || 0, 20);
    frame.writeUInt16BE(data.engine_speed || 0, 22);
    frame.writeUInt16BE(data.accelerator_position || 0, 24);
    frame.writeUInt16BE(data.engine_coolant_temp || 0, 26);
    frame.writeUInt16BE(data.intake_air_temp || 0, 28);
    frame.writeUInt16BE(data.fuel_consumption_rate || 0, 30);
    return frame;
  }

  stopPolling() {
    this.isPolling = false;
  }

  startTrip() { this.isTripActive = true; }
  stopTrip() { this.isTripActive = false; }

  async stopSearch(onStatusChange: StatusCallback, onLog: LogCallback) {
    this.isSearching = false;
    onLog('Search stopped by user.');
    await this.disconnect(onStatusChange, onLog);
  }

  async disconnect(onStatusChange: StatusCallback, onLog: LogCallback) {
    this.stopPolling();
    this.clearKeepAlive();
    if (this.device) {
      try {
        await this.device.disconnect();
        onLog('Device disconnected.');
      } catch (error: any) {
        onLog(`Failed to disconnect: ${error.message}`);
      } finally {
        this.device = null;
        onStatusChange('disconnected');
      }
    }
  }
}

export const obdService = new OBDService();