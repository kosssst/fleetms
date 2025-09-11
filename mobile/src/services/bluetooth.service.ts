import RNBluetoothClassic,
{
  BluetoothDevice,
} from 'react-native-bluetooth-classic';
import { PermissionsAndroid, Platform } from 'react-native';
import * as Location from 'expo-location';
import { Buffer } from 'buffer';

type StatusCallback = (status: 'disconnected' | 'searching' | 'connected' | 'error') => void;
type DeviceCallback = (device: BluetoothDevice | null) => void;
type LogCallback = (message: string) => void;

class BluetoothService {
  private activeDevice: BluetoothDevice | null = null;
  private isSearching = false;
  private isPolling = false;
  private latestLocation: Location.LocationObject | null = null;
  private locationSubscription: { remove: () => void } | null = null;
  private initializeCommands = ['ATZ', 'ATE0', 'ATL0', 'ATSP0'];
  private parameters = ["0104", "0105", "010C", "010D", "010F"];

  async startLocationUpdates(onLog: LogCallback) {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      onLog('Permission to access location was denied');
      return;
    }

    onLog('Starting location updates.');
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        this.latestLocation = location;
      }
    );
  }

  stopLocationUpdates() {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }
  }

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

  async startSearch(onStatusChange: StatusCallback, onDeviceFound: DeviceCallback, onLog: LogCallback) {
    this.isSearching = true;
    onStatusChange('searching');
    onLog('Starting search for paired ELM327 devices...');

    try {
      const pairedDevices = await RNBluetoothClassic.getBondedDevices();
      if (pairedDevices.length === 0) {
        onLog('No paired devices found. Please pair your ELM327 in Android Bluetooth settings.');
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
            onLog(`ELM327 confirmed for device: ${connectedDevice.name}. Connection established.`);
            this.activeDevice = connectedDevice;
            await this.initializeDevice(this.activeDevice, onLog);
            onDeviceFound(this.activeDevice);
            onStatusChange('connected');
            this.isSearching = false;
            this.startPolling(this.activeDevice, onLog);
            return;
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

  private readUntilDelimiter(device: BluetoothDevice, onLog: LogCallback, timeout: number = 5000): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        subscription.remove();
        reject(new Error(`Timeout waiting for delimiter ">"`));
      }, timeout);

      const subscription = device.onDataReceived(data => {
        clearTimeout(timeoutId);
        subscription.remove();
        resolve(data.data);
      });
    });
  }

  private async interrogateDevice(device: BluetoothDevice, onLog: LogCallback): Promise<BluetoothDevice | null> {
    let connectedDevice: BluetoothDevice | null = null;
    try {
      connectedDevice = await RNBluetoothClassic.connectToDevice(device.address, {
        delimiter: '>',
      });
      onLog(`Connected to ${device.name} with delimiter.`);

      await connectedDevice.write('ATI\r');
      const response = await this.readUntilDelimiter(connectedDevice, onLog);

      onLog(`Received response: ${response.trim()}`);
      if (response.includes('ELM327')) {
        return connectedDevice;
      } else {
        await connectedDevice.disconnect();
        return null;
      }
    } catch (error) {
      if (connectedDevice) {
        await connectedDevice.disconnect();
      }
      throw error;
    }
  }

  async stopSearch(onStatusChange: StatusCallback, onLog: LogCallback) {
    this.isSearching = false;
    this.stopPolling();
    onLog('Search stopped by user.');
    try {
        if (this.activeDevice) {
            await this.activeDevice.disconnect();
        }
    } catch (error: any) {
      onLog(`Failed to disconnect: ${error.message}`);
    } finally {
      this.activeDevice = null;
      onStatusChange('disconnected');
    }
  }

  async initializeDevice(device: BluetoothDevice, onLog: LogCallback): Promise<void> {
    try {
      for (const command of this.initializeCommands) {
        onLog(`Sending command: ${command}`);
        await device.write(`${command}\r`);
        const response = await this.readUntilDelimiter(device, onLog);
        onLog(`Response: ${response.trim()}`);
      }
      onLog('Device initialization complete.');
    } catch (error: any) {
      onLog(`Initialization error: ${error.message}`);
      throw error;
    }
  }

  startPolling(device: BluetoothDevice, onLog: LogCallback) {
    this.isPolling = true;
    this.startLocationUpdates(onLog);
    this.pollData(device, onLog);
  }

  stopPolling() {
    this.isPolling = false;
    this.stopLocationUpdates();
  }

  async getGpsAndTimestampHex(onLog: LogCallback): Promise<string> {
    if (!this.latestLocation) {
      onLog('Location not available yet.');
      return '';
    }

    try {
      const { latitude, longitude } = this.latestLocation.coords;

      const latBuffer = Buffer.alloc(4);
      latBuffer.writeFloatBE(latitude, 0);

      const lonBuffer = Buffer.alloc(4);
      lonBuffer.writeFloatBE(longitude, 0);

      const timestamp = Date.now();
      const timestampBuffer = Buffer.alloc(8);
      const high = Math.floor(timestamp / 0x100000000);
      const low = timestamp % 0x100000000;
      timestampBuffer.writeUInt32BE(high, 0);
      timestampBuffer.writeUInt32BE(low, 4);

      return (timestampBuffer.toString('hex') + latBuffer.toString('hex') + lonBuffer.toString('hex')).toUpperCase();
    } catch (error: any) {
      onLog(`Error processing GPS and timestamp: ${error.message}`);
      return '';
    }
  }

  async pollData(device: BluetoothDevice, onLog: LogCallback) {
    while (this.isPolling) {
      try {
        let concatenatedResponses = '';
        for (const param of this.parameters) {
          if (!this.isPolling) break;

          onLog(`Polling with param: ${param}`);
          await device.write(`${param}\r`);
          const response = await this.readUntilDelimiter(device, onLog);
          const cleanedResponse = response.trim().split(' ').slice(2).join('');
          concatenatedResponses += cleanedResponse;
        }

        if (concatenatedResponses) {
          const gpsAndTimestampHex = await this.getGpsAndTimestampHex(onLog);
          const finalResponse = gpsAndTimestampHex + concatenatedResponses;
          onLog(`Concatenated responses: ${finalResponse.trim()}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        onLog(`Error during polling: ${error.message}`);
        this.stopPolling();
        // Optionally, trigger a disconnect status update here
      }
    }
  }
}

export const bluetoothService = new BluetoothService();
