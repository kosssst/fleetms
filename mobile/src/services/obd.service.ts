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

type DataCallback = (data: any) => void;

// --- OBDService Class ---
class OBDService {
  private device: BluetoothDevice | null = null;
  private pollingInterval: any = null;
  private isTripActive: boolean = false;
  private isSearching: boolean = false;
  private keepAliveTimer: any = null;
  private dataListeners: Set<DataCallback> = new Set();
  private connectionStatus: 'disconnected' | 'searching' | 'connected' | 'error' = 'disconnected';

  private commandsMap: CommandMap = {};
  private headersOrder: string[] = [];
  private minLenNeeded: MinLenMap = {};

  constructor() {
    this.loadCommandTable();
  }

  public getDevice(): BluetoothDevice | null {
    return this.device;
  }

  public getConnectionStatus(): 'disconnected' | 'searching' | 'connected' | 'error' {
    return this.connectionStatus;
  }

  public registerListener(listener: DataCallback) {
    this.dataListeners.add(listener);
  }

  public unregisterListener(listener: DataCallback) {
    this.dataListeners.delete(listener);
  }

  private notifyListeners(data: any) {
    this.dataListeners.forEach(listener => listener(data));
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
    this.connectionStatus = 'searching';
    onStatusChange('searching');
    onLog('Starting search for paired ELM327 devices...');
    try {
      const pairedDevices = await RNBluetoothClassic.getBondedDevices();
      if (pairedDevices.length === 0) {
        onLog('No paired devices found.');
        this.connectionStatus = 'error';
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
            this.connectionStatus = 'connected';
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
        this.connectionStatus = 'disconnected';
        onStatusChange('disconnected');
      }
    } catch (error: any) {
      onLog(`Error getting paired devices: ${error.message}`);
      this.connectionStatus = 'error';
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
        delimiter: '>',
        charset: 'ascii',
      });

      await this.drainInitialPrompt(connectedDevice);  // swallow initial ">"

      onLog(`Connected to ${device.name}.`);

      // --- Attempt 1: send ATI and collect for a short window
      await connectedDevice.write('ATI\r');
      let response = await this.readUntilDelimiter(
        connectedDevice,
        3500,                               // a bit generous for the first reply
        { ignoreBarePromptOnce: true, accumulateMs: 400 }   // <— key
      );

      // Be case-insensitive (some clones use lower/upper variations)
      if (response.toUpperCase().includes('ELM327')) return connectedDevice;

      // --- Optional Attempt 2: one more ATI with a fresh buffer (no other commands)
      await connectedDevice.clear();
      await new Promise(r => setTimeout(r, 120));
      await connectedDevice.write('ATI\r');
      response = await this.readUntilDelimiter(
        connectedDevice,
        3500,
        { ignoreBarePromptOnce: true, accumulateMs: 500 }
      );

      onLog(`ATI response (1st): ${JSON.stringify(response)}`);

      if (response.toUpperCase().includes('ELM327')) return connectedDevice;

      await connectedDevice.disconnect();
      return null;

    } catch (error) {
      if (connectedDevice) {
        try { await connectedDevice.disconnect(); } catch {}
      }
      throw error;
    }
  }

  private async drainInitialPrompt(dev: BluetoothDevice) {
    try { await dev.clear(); } catch {}
    // tiny settle so late bytes from the OS/prompt get delivered
    await new Promise(res => setTimeout(res, 60));
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
      const readP = this.readUntilDelimiter(this.device, timeout ?? 1500);
      await this.device.write(cmd + '\r');
      await new Promise(r => setTimeout(r, 60));
      return await readP;
    } finally {
      this.scheduleKeepAlive();
    }
  }

  private readUntilDelimiter(
    device: BluetoothDevice,
    timeoutMs = 5000,
    options?: { ignoreBarePromptOnce?: boolean; accumulateMs?: number }
  ): Promise<string> {
    const ignoreBare = options?.ignoreBarePromptOnce ?? false;
    const accumulateMs = options?.accumulateMs ?? 0;

    return new Promise((resolve, reject) => {
      let resolved = false;
      let sawBarePrompt = false;
      let buf = '';

      const finish = (ok: boolean, data?: string, err?: Error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(t);
        if (accTimer) clearTimeout(accTimer);
        sub.remove();
        ok ? resolve(data || '') : reject(err!);
      };

      const t = setTimeout(() => finish(false, undefined, new Error('Timeout waiting for ">"')), timeoutMs);
      const accTimer = accumulateMs
        ? setTimeout(() => finish(true, buf || ''), accumulateMs)
        : null;

      const sub = device.onDataReceived(event => {
        const data = String(event.data ?? '');

        // Ignore a first bare ">" (with optional CR/LF) once
        if (ignoreBare && !sawBarePrompt && /^\s*>\s*$/m.test(data)) {
          sawBarePrompt = true;
          return;
        }

        buf += data;

        // If not accumulating, return immediately on the first frame
        if (!accumulateMs) finish(true, buf);
        // else: keep collecting until accumulateMs elapses
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
  private pollingPromise: Promise<void> | null = null;

  startPolling(
    sendDataCallback: (data: Buffer) => void,
    numberOfCylinders: number,
    getLocation: () => { latitude?: number; longitude?: number; altitude?: number },
  ) {
    if (this.isPolling) {
      return;
    }
    this.isPolling = true;
    this.pollingPromise = this.poll(sendDataCallback, numberOfCylinders, getLocation);
  }

  private async poll(
    sendDataCallback: (data: Buffer) => void,
    numberOfCylinders: number,
    getLocation: () => { latitude?: number; longitude?: number; altitude?: number },
  ) {
    while (this.isPolling) {
      const loopStart = Date.now();

      if (this.device && this.isTripActive) {
        const allData: any = {};
        for (const cmd of Object.keys(this.commandsMap)) {
          if (!this.isPolling || !this.isTripActive) break;

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

        if (this.isPolling && this.isTripActive) {
            allData.fuel_consumption_rate = (allData.fuel_per_stroke || 0) * numberOfCylinders;
            delete allData.fuel_per_stroke;

            this.notifyListeners(allData);
            const location = getLocation();
            const dataFrame = this.createDataFrame(
                allData,
                location.latitude,
                location.longitude,
                location.altitude,
            );
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

  createDataFrame(
      data: any,
      latitude?: number,
      longitude?: number,
      altitude?: number,
  ): Buffer {
    const frame = Buffer.alloc(32);
    const timestamp = Date.now();
    const high = Math.floor(timestamp / 4294967296);
    const low = timestamp % 4294967296;
    frame.writeUInt32BE(high, 0);
    frame.writeUInt32BE(low, 4);
    frame.writeInt32BE(latitude ? Math.round(latitude * 1e7) : 0, 8);
    frame.writeInt32BE(longitude ? Math.round(longitude * 1e7) : 0, 12);
    frame.writeInt32BE(altitude ? Math.round(altitude * 100) : 0, 16);
    frame.writeUInt16BE(data.vehicle_speed || 0, 20);
    frame.writeUInt16BE(data.engine_speed || 0, 22);
    frame.writeUInt16BE(data.accelerator_position || 0, 24);
    frame.writeUInt16BE(data.engine_coolant_temp || 0, 26);
    frame.writeUInt16BE(data.intake_air_temp || 0, 28);
    frame.writeUInt16BE(data.fuel_consumption_rate || 0, 30);
    return frame;
  }

  async stopPolling() {
    this.isPolling = false;
    if (this.pollingPromise) {
      await this.pollingPromise;
      this.pollingPromise = null;
    }
  }

  startTrip() {
    this.isTripActive = true;
  }
  stopTrip() {
    this.isTripActive = false;
  }

  pauseTrip() {
    this.isTripActive = false;
  }

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
        this.connectionStatus = 'disconnected';
        onStatusChange('disconnected');
      }
    }
  }
}

export const obdService = new OBDService();