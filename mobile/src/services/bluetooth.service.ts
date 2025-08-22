import RNBluetoothClassic,
{
  BluetoothDevice,
} from 'react-native-bluetooth-classic';
import { PermissionsAndroid, Platform } from 'react-native';

type StatusCallback = (status: 'disconnected' | 'searching' | 'connected' | 'error') => void;
type DeviceCallback = (device: BluetoothDevice | null) => void;
type LogCallback = (message: string) => void;

class BluetoothService {
  private activeDevice: BluetoothDevice | null = null;
  private isSearching = false;

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
          const isElmDevice = await this.interrogateDevice(device, onLog);
          if (isElmDevice) {
            onLog(`ELM327 confirmed for device: ${device.name}. Connection established.`);
            this.activeDevice = device;
            onDeviceFound(this.activeDevice);
            onStatusChange('connected');
            this.isSearching = false;
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
        onLog(`Received data: ${data.data}`);
        clearTimeout(timeoutId);
        subscription.remove();
        resolve(data.data);
      });
    });
  }

  private async interrogateDevice(device: BluetoothDevice, onLog: LogCallback): Promise<boolean> {
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
        return true;
      } else {
        await connectedDevice.disconnect();
        return false;
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
}

export const bluetoothService = new BluetoothService();
