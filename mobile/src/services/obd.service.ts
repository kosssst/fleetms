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

const UPDATE_CODE = '3E01';

type StatusCallback = (
  status: 'disconnected' | 'searching' | 'connected' | 'error',
) => void;
type DeviceCallback = (device: BluetoothDevice | null) => void;
type LogCallback = (message: string) => void;

const decoders = {
  '21A0': [
    {
      startByte: 15,
      numBits: 16,
      header: 'vehicle_speed',
      decoder: vehicleSpeedDecoder,
    },
    {
      startByte: 13,
      numBits: 16,
      header: 'engine_speed',
      decoder: engineSpeedDecoder,
    },
  ],
  '21A1': [
    {
      startByte: 50,
      numBits: 16,
      header: 'accelerator_position',
      decoder: acceleratorPositionDecoder,
    },
    {
      startByte: 25,
      numBits: 16,
      header: 'engine_coolant_temp',
      decoder: temperatureDecoder,
    },
    {
      startByte: 27,
      numBits: 16,
      header: 'intake_air_temp',
      decoder: temperatureDecoder,
    },
  ],
  '21A5': [
    {
      startByte: 9,
      numBits: 16,
      header: 'fuel_per_stroke',
      decoder: fuelPerStrokeDecoder,
    },
  ],
};

class OBDService {
  private device: BluetoothDevice | null = null;
  private pollingInterval: any = null;
  private isTripActive: boolean = false;
  private isSearching: boolean = false;

  async requestPermissions(onLog: LogCallback): Promise<boolean> {
    if (Platform.OS === 'ios') {
      return true;
    }

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
        onLog(
          'No paired devices found. Please pair your ELM327 in Android Bluetooth settings.',
        );
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
            onLog(
              `ELM327 confirmed for device: ${connectedDevice.name}. Connection established.`, 
            );
            this.device = connectedDevice;
            await this.initializeELM327(onLog);
            onDeviceFound(this.device);
            onStatusChange('connected');
            this.isSearching = false;
            return; // Found and connected, so we exit the loop
          }
        } catch (error: any) {
          onLog(`Failed to interrogate ${device.name}: ${error.message}`);
        }
      }

      if (this.isSearching) {
        onLog('No ELM327 device found among paired devices.');
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
      onLog("Sent 'ATI'")
      const response = await this.readUntilDelimiter(connectedDevice);

      onLog(`Received response: ${response.trim()}`);
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

  async stopSearch(onStatusChange: StatusCallback, onLog: LogCallback) {
    this.isSearching = false;
    onLog('Search stopped by user.');
    await this.disconnect(onStatusChange, onLog);
  }

  async initializeELM327(onLog: LogCallback) {
    const initCommands = [
      'ATZ',
      'ATE0', // echo off
      'ATL0', // linefeeds off
      'ATS0', // spaces off
      'ATH0', // headers on if you need raw frames; or ATH0 otherwise
      'ATSP5', // protocol 5 (ISO 9141-2) - adjust as needed
      'ATDPN', // show current protocol
      'ATIIA 7A', // set init address if KWP/diag
      'ATSH 81 7A F1',
      'ATST C8', // timeout tweak
      'ATAT0', // adaptive timing off (optional)
      '3E01', // tester present
      '10C0', // start diagnostic session (if required for your ECU)
      '3E01',
    ];

    for (const cmd of initCommands) {
      onLog(`Sending init command: ${cmd}`);
      const response = await this.sendCommand(cmd);
      onLog(`Response: ${response.trim()}`);
      if (cmd === 'ATZ') {
        await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    onLog('Device initialization complete.');
  }

  async sendCommand(cmd: string): Promise<string> {
    if (!this.device) {
      throw new Error('Device not connected');
    }
    await this.device.write(cmd + '\r');
    const response = await this.readUntilDelimiter(this.device);
    return response;
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

  startPolling(
    dataCallback: (data: any) => void,
    sendDataCallback: (data: Buffer) => void,
    numberOfCylinders: number,
  ) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      if (!this.device) {
        this.stopPolling();
        return;
      }

      if (this.isTripActive) {
        const allData: any = {};
        for (const command of Object.keys(decoders)) {
          try {
            const response = await this.sendCommand(command);
            const cleaned = response.replace(/\s/g, '').replace('>', '');
            const responseBytes = Buffer.from(cleaned, 'hex');

            const commandDecoders =
              decoders[command as keyof typeof decoders];
            for (const decoderInfo of commandDecoders) {
              const start = decoderInfo.startByte;
              const end = start + decoderInfo.numBits / 8;
              if (responseBytes.length >= end) {
                const valueBytes = responseBytes.slice(start, end);
                const rawValue = valueBytes.readUInt16BE(0);
                allData[decoderInfo.header] = decoderInfo.decoder(rawValue);
              }
            }
          } catch (error) {
            console.error(`Error polling command ${command}:`, error);
            // Decide if we should stop polling on error
          }
        }
        allData.fuel_consumption_rate =
          (allData.fuel_per_stroke || 0) * numberOfCylinders;
        delete allData.fuel_per_stroke;

        dataCallback(allData);
        const dataFrame = this.createDataFrame(allData);
        sendDataCallback(dataFrame);
      } else {
        try {
          await this.sendCommand(UPDATE_CODE);
        } catch (error) {
          console.error('Error sending update code:', error);
        }
      }
    }, 1000);
  }

  createDataFrame(data: any): Buffer {
    const frame = Buffer.alloc(32);
    const timestamp = Date.now();
    const high = Math.floor(timestamp / 4294967296); // 2**32
    const low = timestamp % 4294967296;
    frame.writeUInt32BE(high, 0);
    frame.writeUInt32BE(low, 4);
    // GPS data is not available in this service, will be filled with 0
    frame.writeInt32BE(0, 8); // longitude
    frame.writeInt32BE(0, 12); // latitude
    frame.writeInt32BE(0, 16); // altitude
    frame.writeUInt16BE(data.vehicle_speed || 0, 20);
    frame.writeUInt16BE(data.engine_speed || 0, 22);
    frame.writeUInt16BE(data.accelerator_position || 0, 24);
    frame.writeUInt16BE(data.engine_coolant_temp || 0, 26);
    frame.writeUInt16BE(data.intake_air_temp || 0, 28);
    frame.writeUInt16BE(data.fuel_consumption_rate || 0, 30);
    return frame;
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  startTrip() {
    this.isTripActive = true;
  }

  stopTrip() {
    this.isTripActive = false;
  }

  async disconnect(onStatusChange: StatusCallback, onLog: LogCallback) {
    this.stopPolling();
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
