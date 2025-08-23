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
  private isPolling = false;
  private initializeCommands = ['ATZ', 'ATE0', 'ATL0', 'ATSP0'];
  private parameters = ["0104", "0105", "010C", "010D", "010F"];

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
    this.pollData(device, onLog);
  }

  stopPolling() {
    this.isPolling = false;
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
          onLog(`Concatenated responses: ${concatenatedResponses.trim()}`);
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
