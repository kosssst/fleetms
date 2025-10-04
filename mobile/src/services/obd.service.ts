import RNBluetoothClassic,
{
  BluetoothDevice,
} from 'react-native-bluetooth-classic';
import { Buffer } from 'buffer';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  // acceleratorPositionDecoder,
  // engineSpeedDecoder,
  fuelPerStrokeDecoder,
  // temperatureDecoder,
  // vehicleSpeedDecoder,
} from '../utils/decoders';
import { obdParameters, ObdParameter } from '../config/obd-parameters';
import config from '../config/config';

type InitStep = {
  cmd: string;
  timeout?: number;
  accumulateMs?: number;
  allowEmpty?: boolean;   // <- new
};

// --- Constants from obd_csv.py ---
const UPDATE_CODE = '3E01';
// const READ_TIMEOUT_PRIMARY = config.READ_TIMEOUT_PRIMARY;
const KEEPALIVE_PERIOD = config.KEEPALIVE_PERIOD;
const SAMPLE_PERIOD_SEC = config.SAMPLE_PERIOD_SEC;
const INTERROGATE_DEVICE_TIMEOUT_1 = config.INTERROGATE_DEVICE_TIMEOUT_1;
const INTERROGATE_DEVICE_TIMEOUT_2 = config.INTERROGATE_DEVICE_TIMEOUT_2;
const SEND_COMMAND_DEFAULT_TIMEOUT = config.SEND_COMMAND_DEFAULT_TIMEOUT;
const READ_UNTIL_DELIMITER_DEFAULT_TIMEOUT = config.READ_UNTIL_DELIMITER_DEFAULT_TIMEOUT;

// --- Type definitions ---
type StatusCallback = (
  status: 'disconnected' | 'searching' | 'connected' | 'error',
) => void;
type DeviceCallback = (device: BluetoothDevice | null) => void;
type LogCallback = (message: string) => void;

// const decoders: { [key: string]: (payload: Buffer) => number } = {
//   vehicleSpeedDecoder,
//   engineSpeedDecoder,
//   acceleratorPositionDecoder,
//   temperatureDecoder,
//   fuelPerStrokeDecoder,
// };

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
  private headerPrimed = false;
  private minLenNeeded: MinLenMap = {};
  private inInit = false;
  private _lock: Promise<void> = Promise.resolve();
  private _withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = async () => await fn();
    const p = this._lock.then(run, run);
    // keep chain alive regardless of success/failure
    this._lock = p.then(() => undefined, () => undefined);
    return p;
  }

  private lastRaw: Record<string, number> = {
    vehicle_speed: 0,
    engine_speed: 0,
    accelerator_position: 0,
    engine_coolant_temp: 0,
    intake_air_temp: 0,
    fuel_consumption_rate: 0,
  };

  private lastDecoded: Record<string, number> = {};

  private headersOrder: string[] = [];

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

      await this.drainInitialPrompt(connectedDevice);
      onLog(`Connected to ${device.name}.`);

      await connectedDevice.write('ATI\r');
      let response = await this.readUntilDelimiter(
        connectedDevice,
        INTERROGATE_DEVICE_TIMEOUT_1,
        { accumulateMs: 400 }
      );
      if (response.toUpperCase().includes('ELM327')) return connectedDevice;

      await connectedDevice.clear();
      await new Promise(r => setTimeout(r, 120));
      await connectedDevice.write('ATI\r');
      response = await this.readUntilDelimiter(
        connectedDevice,
        INTERROGATE_DEVICE_TIMEOUT_2,
        { accumulateMs: 500 }
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
    this.inInit = true;
    this.clearKeepAlive();

    // ATZ: long window
    onLog('Sending init command: ATZ');
    let atzResp = await this.sendCommand('ATZ', 4000, undefined);

    // If banner didn't flush yet, nudge with CR then quick read
    if (!atzResp || atzResp.trim().length === 0) {
      try {
        await this.device?.write('\r');
        await new Promise(r => setTimeout(r, 200));
        atzResp = await this.sendCommand('', 1500, undefined);
      } catch {}
    }

    await new Promise(r => setTimeout(r, 800));
    try { await this.device?.clear(); } catch {}

    const initPlan: InitStep[] = [
      { cmd: 'ATE0',          timeout: 1000 },
      { cmd: 'ATL0',          timeout: 1000 },
      { cmd: 'ATS0',          timeout: 1000 },
      { cmd: 'ATH1',          timeout: 1000 },

      { cmd: 'ATSP5',         timeout: 1200 },
      { cmd: 'ATDPN',         timeout: 1000 },
      { cmd: 'ATIIA 7A',      timeout: 1000 },
      { cmd: 'ATSH 81 7A F1', timeout: 1000 },
      { cmd: 'ATST C8',       timeout: 1000 },
      { cmd: 'ATAT1',         timeout: 1000 },   // adaptive timing ON for polling

      // KWP handshake — give it more time; allow empty
      { cmd: '81',            timeout: 3500, allowEmpty: true },

      { cmd: '3E01',          timeout: 1200 },   // tester present
      { cmd: '10C0',          timeout: 2500 },   // session control

      // final nudge + first sample (optional)
      { cmd: '3E01',          timeout: 1200 },
      { cmd: '21A5',          timeout: 1200 },
    ];

    for (const step of initPlan) {
      if (step.cmd.startsWith('PAUSE:')) {
        const ms = parseInt(step.cmd.split(':')[1], 10) || 120;
        await new Promise(r => setTimeout(r, ms));
        continue;
      }

      onLog(`Sending init command: ${step.cmd}`);
      let resp = await this.sendCommand(step.cmd, step.timeout, step.accumulateMs);

      const isBad = (!resp && !step.allowEmpty) || /STOPPED/i.test(resp);
      if (isBad) {
        await this.resync();
        resp = await this.sendCommand(
          step.cmd,
          (step.timeout ?? 1500) + 800,
          step.accumulateMs ?? 600
        );
        const stillBad = (!resp && !step.allowEmpty) || /STOPPED/i.test(resp);
        if (stillBad) {
          this.inInit = false;
          throw new Error(`Init step ${step.cmd} failed`);
        }
      }
    }

    await this.sendCommand('ATSH 81 7A F1', 400);
    this.headerPrimed = true;
    onLog('Device initialization complete.');
    this.inInit = false;
    this.scheduleKeepAlive();
  }


  private scheduleKeepAlive() {
    // Never run KA during init or trip
    if (this.inInit || this.isTripActive) return;
    this.clearKeepAlive();
    this.keepAliveTimer = setTimeout(() => {
      if (this.device && !this.inInit && !this.isTripActive) {
        console.log('Sending keep-alive command (3E01)');
        this.sendCommand(UPDATE_CODE).catch(err => console.error('Failed to send keep-alive:', err));
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

  private sendChain: Promise<void> = Promise.resolve();

  async sendCommand(
    cmd: string,
    timeout?: number,
    accumulateMs?: number
  ): Promise<string> {
    return this._withLock(() => this._sendCommandInternal(cmd, timeout, accumulateMs));
  }


  // replace your _sendCommandInternal with this version
  private async _sendCommandInternal(
    cmd: string,
    timeout?: number,
    accumulateMs?: number,
    // ignoreBarePromptOnce: boolean = false
  ): Promise<string> {
    if (!this.device) throw new Error('Device not connected');
    this.clearKeepAlive();
    try {
      await this.device.clear();
      const readP = this.readUntilDelimiter(
        this.device,
        timeout ?? SEND_COMMAND_DEFAULT_TIMEOUT,
        { accumulateMs } // delimiter mode: no '>' in event.data; no need to track ignoreBare here
      );
      // ↓ Python QUIET_DELAY_S is ~12 ms. Use same here.
      await this.device.write(cmd + '\r');
      await new Promise(r => setTimeout(r, accumulateMs ? 12 : 12));
      return await readP;
    } finally {
      if (!this.inInit) this.scheduleKeepAlive();
    }
  }


  private async resync(): Promise<void> {
    if (!this.device) return;
    await this.device.write('ATPC\r');             // protocol close
    await new Promise(r => setTimeout(r, 150));
    await this.device.write('\r');                 // nudge for fresh '>'
    await new Promise(r => setTimeout(r, 150));
    try { await this.device.clear(); } catch {}
  }

  private readUntilDelimiter(
    device: BluetoothDevice,
    timeoutMs = READ_UNTIL_DELIMITER_DEFAULT_TIMEOUT,
    options?: { accumulateMs?: number }
  ): Promise<string> {
    const accWindow = options?.accumulateMs ?? 0;

    return new Promise((resolve, reject) => {
      let resolved = false;
      let buf = '';
      let accTimer: any = null;

      const finish = (ok: boolean, data?: string, err?: Error) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(hardT);
        if (accTimer) clearTimeout(accTimer);
        sub.remove();
        ok ? resolve(data ?? '') : reject(err!);
      };

      const hardT = setTimeout(() => finish(true, buf), timeoutMs);

      const restartDebounce = () => {
        if (!accWindow) return;
        if (accTimer) clearTimeout(accTimer);
        accTimer = setTimeout(() => {
          if (buf.replace(/\s+/g, '').length > 0) finish(true, buf);
          // else let hard timeout fire
        }, accWindow);
      };

      const sub = device.onDataReceived(event => {
        const data = String(event.data ?? '');
        if (!data || /^\s*$/.test(data)) return;
        console.log(`[RX] ${JSON.stringify(data)}`);  // keep while tuning

        if (accWindow) {
          buf += data;
          restartDebounce();      // reset on every chunk
        } else {
          finish(true, data);     // one frame = one response
        }
      });
    });
  }

  private extractPayload(cmd: string, resp: string, minLen: number): Buffer | null {
    // We want the payload INCLUDING the 2-byte '61Ax' header at the beginning.
    const wanted = '61' + cmd.substring(2);           // e.g. 21A0 -> 61A0
    const hexOnly = resp.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
    const pos = hexOnly.indexOf(wanted);
    if (pos === -1) return null;

    // Include the header in the payload so startByte=1 points at '61'
    const payloadHex = hexOnly.substring(pos);

    // minLen now must also include those 2 bytes
    if (payloadHex.length / 2 < minLen) return null;

    return Buffer.from(payloadHex, 'hex');
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

  private u16be(payload: Buffer, firstByte1Based: number): number | null {
    const i = firstByte1Based - 1;
    if (i < 0 || i + 1 >= payload.length) return null;
    return ((payload[i] << 8) | payload[i + 1]) >>> 0;
  }

  private async poll(
    sendDataCallback: (data: Buffer) => void,
    numberOfCylinders: number,
    getLocation: () => { latitude?: number; longitude?: number; altitude?: number },
  ) {
    const DENSITY_MG_PER_ML = 835; // diesel
    const ZERO_RAW = 0x0097, FULL_RAW = 0x0339;

    while (this.isPolling) {
      const t0 = Date.now();
      try {

        if (this.device && this.isTripActive) {
          // fresh batch
          const rawNow: Record<string, number> = {};
          const decNow: Record<string, number> = {};

          // keep header primed
          if (!this.headerPrimed) {
            try {
              await this.sendCommand('ATSH 81 7A F1', 300);
            } catch {
            }
            this.headerPrimed = true;
          }

          let sawA0 = false, sawA1 = false;
          const perCmdTimeoutMs = 320;
          const tinyGapMs = 8;

          // ---- 21A0: vehicle speed + *current* engine rpm (bytes 13–14) ----
          try {
            const resp = await this.sendCommand('21A0', perCmdTimeoutMs);
            if (/STOPPED/i.test(resp)) this.headerPrimed = false;
            const payload = this.extractPayload('21A0', resp, 16) || Buffer.alloc(0);
            if (payload.length) {
              sawA0 = true;

              // engine rpm at bytes 13–14 (confirmed by manufacturer app)
              const rpmRaw = this.u16be(payload, 13);                    // <-- FIX
              if (rpmRaw != null) {
                rawNow.engine_speed = rpmRaw;
                decNow.engine_speed = rpmRaw; // UI shows raw rpm
              }

              // vehicle speed at bytes 15–16 (your table)
              const spdRaw = this.u16be(payload, 15);
              if (spdRaw != null) {
                decNow.vehicle_speed = spdRaw / 100.0;                   // km/h
                rawNow.vehicle_speed = Math.min(0xFFFF, Math.max(0, Math.round(decNow.vehicle_speed * 100)));
              }
            }
          } catch {
            this.headerPrimed = false;
          }
          if (tinyGapMs) await new Promise(r => setTimeout(r, tinyGapMs));

          // ---- 21A1: accel %, coolant, intake temps ----
          try {
            const resp = await this.sendCommand('21A1', perCmdTimeoutMs);
            if (/STOPPED/i.test(resp)) this.headerPrimed = false;
            const payload = this.extractPayload('21A1', resp, 52) || Buffer.alloc(0);
            if (payload.length) {
              sawA1 = true;

              // accelerator position (bytes 50–51 -> percent by your decoder)
              const accelRaw = this.u16be(payload, 52);
              if (accelRaw != null) {

                const span = FULL_RAW - ZERO_RAW;
                let percent = (accelRaw - ZERO_RAW) * 100 / span;
                console.log(`AccelRaw: ${accelRaw.toString(16)}`)
                if (!Number.isFinite(percent)) percent = 0;
                // Clamp to 0..100 for UI so tiny noise doesn’t jump to 100
                percent = Math.max(0, Math.min(100, percent));
                decNow.accelerator_position = percent;

                // Re-encode to raw pedal counts for the frame (don’t use >100):
                const pedalRaw = Math.round(ZERO_RAW + (percent * span) / 100);
                rawNow.accelerator_position = Math.max(0, Math.min(0xFFFF, pedalRaw));
              }

              // coolant temp @ 25–26, intake @ 27–28 (1-based in payload)
              const coolRaw = this.u16be(payload, 25);
              if (coolRaw != null) {
                decNow.engine_coolant_temp = (coolRaw / 10.0) - 273.15;
                rawNow.engine_coolant_temp = Math.min(0xFFFF, Math.max(0, Math.round((decNow.engine_coolant_temp + 273.15) * 10)));
              }

              const iatRaw = this.u16be(payload, 27);
              if (iatRaw != null) {
                decNow.intake_air_temp = (iatRaw / 10.0) - 273.15;
                rawNow.intake_air_temp = Math.min(0xFFFF, Math.max(0, Math.round((decNow.intake_air_temp + 273.15) * 10)));
              }
            }
          } catch {
            this.headerPrimed = false;
          }
          if (tinyGapMs) await new Promise(r => setTimeout(r, tinyGapMs));

          // ---- 21A5: fuel per stroke (mg/stroke) at bytes 9–10 ----
          try {
            const resp = await this.sendCommand('21A5', perCmdTimeoutMs);
            if (/STOPPED/i.test(resp)) this.headerPrimed = false;
            const payload = this.extractPayload('21A5', resp, 10) || Buffer.alloc(0);
            if (payload.length) {
              // sawA5 = true;
              const fpsRaw = this.u16be(payload, 9);
              if (fpsRaw != null) {
                // your decoder for 21A5 is mg/stroke = raw / 10 (if different, adjust)
                decNow.fuel_per_stroke = fuelPerStrokeDecoder(Buffer.from([payload[8], payload[9]]));
              }
            }
          } catch {
            this.headerPrimed = false;
          }

          // ---- carry-forward + miss handling ----
          const keys: (keyof typeof this.lastRaw)[] = [
            'vehicle_speed', 'engine_speed', 'accelerator_position',
            'engine_coolant_temp', 'intake_air_temp'
          ];

          for (const k of keys) {
            const seen = rawNow[k] !== undefined || decNow[k] !== undefined;
            this.bumpOrResetMiss(k, seen);

            if (rawNow[k] === undefined) rawNow[k] = this.lastRaw[k] ?? 0;
            if (decNow[k] === undefined && this.lastDecoded[k] !== undefined) {
              decNow[k] = this.lastDecoded[k];
            }
          }

          // if a whole PID was absent, tick misses to allow falling to zero
          if (!sawA0) this.bumpOrResetMiss('engine_speed', false);
          if (!sawA1) {
            this.bumpOrResetMiss('engine_coolant_temp', false);
            this.bumpOrResetMiss('intake_air_temp', false);
          }

          // ---- fuel rate (mL/s), only when both rpm & mg/stroke are present ----
          let ml_per_s = 0;

// Normalized, numeric inputs
          const rpm = Number(rawNow.engine_speed ?? 0) || 0;
          const mgStroke = Number(decNow.fuel_per_stroke ?? this.lastDecoded.fuel_per_stroke ?? 0) || 0;

// If engine is stopped (or clearly not spinning), force 0
          if (rpm >= 100 && mgStroke > 0 && Number.isFinite(mgStroke)) {
            // 4-stroke: injections/s = rpm * cylinders / 120
            const mg_per_s = (mgStroke * (rpm * numberOfCylinders)) / 120;
            const computed = mg_per_s / DENSITY_MG_PER_ML;

            // Clamp tiny noise to 0, and make sure it's finite
            ml_per_s = Number.isFinite(computed) && computed >= 0.05 ? computed : 0;
          }

// Write back **always**, never leave NaN in the cache
          decNow.fuel_consumption_rate = ml_per_s;
          rawNow.fuel_consumption_rate = Math.min(0xFFFF, Math.max(0, Math.round(ml_per_s)));

          // cache + emit
          Object.assign(this.lastRaw, rawNow);
          Object.assign(this.lastDecoded, decNow);

          if (this.isPolling && this.isTripActive) {
            this.notifyListeners({...this.lastDecoded});
            const loc = getLocation();
            const dataFrame = this.createDataFrame(
              rawNow, loc.latitude, loc.longitude, loc.altitude
            );
            sendDataCallback(dataFrame);
          }
        }
      } catch (err) {            // <-- add catch
        console.warn('[poll] cycle error:', err);
        this.headerPrimed = false; // force re-prime next lap
      }
      const elapsed = Date.now() - t0;
      console.log(`elapsed: ${elapsed/1000}s`);
      const delay = Math.max(0, SAMPLE_PERIOD_SEC * 1000 - elapsed);
      if (delay > 0) await new Promise(r => setTimeout(r, delay));
    }
  }

  private missCounters: Partial<Record<keyof typeof this.lastRaw, number>> = {};

  /** If a value wasn't seen this cycle, slowly decay to 0 after a few misses */
  private bumpOrResetMiss(k: keyof typeof this.lastRaw, seen: boolean) {
    const LIMIT = 3; // keep last value up to 3 missed cycles
    if (seen) {
      this.missCounters[k] = 0;
      return;
    }
    const n = (this.missCounters[k] ?? 0) + 1;
    this.missCounters[k] = n;
    if (n > LIMIT) {
      // after LIMIT misses, zero both decoded+raw for this key
      this.lastRaw[k] = 0;
      delete this.lastDecoded[k];
    }
  }

  createDataFrame(
    raw: any, // expect rawCache from poll()
    latitude?: number,
    longitude?: number,
    altitude?: number,
  ): Buffer {
    const frame = Buffer.alloc(32);

    // timestamp as uint64 (ms since epoch)
    const ts = Date.now();
    const hi = Math.floor(ts / 0x100000000);
    const lo = ts >>> 0;
    frame.writeUInt32BE(hi, 0);
    frame.writeUInt32BE(lo, 4);

    // gps_* int32 encodings
    const latEnc = latitude  != null ? Math.round(latitude  * 1e7) : 0;
    const lonEnc = longitude != null ? Math.round(longitude * 1e7) : 0;
    const altEnc = altitude  != null ? Math.round(altitude  * 100) : 0; // cm
    frame.writeInt32BE(latEnc,  8);
    frame.writeInt32BE(lonEnc, 12);
    frame.writeInt32BE(altEnc, 16);

    // uint16 fields: values already pre-encoded to "raw" in poll()
    const u16 = (v: number) => Math.max(0, Math.min(0xFFFF, v | 0));

    frame.writeUInt16BE(u16(raw.vehicle_speed ?? 0),        20); // raw (km/h*100)
    frame.writeUInt16BE(u16(raw.engine_speed ?? 0),         22); // raw rpm
    frame.writeUInt16BE(u16(raw.accelerator_position ?? 0), 24); // raw pedal counts
    frame.writeUInt16BE(u16(raw.engine_coolant_temp ?? 0),  26); // raw K*10
    frame.writeUInt16BE(u16(raw.intake_air_temp ?? 0),      28); // raw K*10
    frame.writeUInt16BE(u16(raw.fuel_consumption_rate ?? 0),30); // raw ml/s

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
    if (!this.headerPrimed && this.device) {
      // best-effort, don't block the UI if it fails; next poll will try again
      this.sendCommand('ATSH 81 7A F1', 400).catch(() => {});
      this.headerPrimed = true;
    }
  }

  stopTrip() {
    this.isTripActive = false;
    // When the trip ends, periodic KA can resume
    this.scheduleKeepAlive();
  }

  pauseTrip() {
    this.isTripActive = false;
    this.scheduleKeepAlive();
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