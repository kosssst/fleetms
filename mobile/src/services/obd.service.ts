import RNBluetoothClassic, { BluetoothDevice } from 'react-native-bluetooth-classic';
import { Buffer } from 'buffer';

const commands = [
  '21A0',
  '21A1',
  '21A5',
];

const decoders = {
  '21A0': [
    { startByte: 15, numBits: 16, header: 'vehicle_speed' },
    { startByte: 13, numBits: 16, header: 'engine_speed' },
  ],
  '21A1': [
    { startByte: 50, numBits: 16, header: 'accelerator_position' },
    { startByte: 25, numBits: 16, header: 'engine_coolant_temp' },
    { startByte: 27, numBits: 16, header: 'intake_air_temp' },
  ],
  '21A5': [
    { startByte: 9, numBits: 16, header: 'fuel_per_stroke' },
  ],
};

class OBDService {
  private device: BluetoothDevice | null = null;
  private pollingInterval: any = null;

  async connectToDevice() {
    try {
      const devices = await RNBluetoothClassic.getBondedDevices();
      const elmDevice = devices.find((d: BluetoothDevice) => d.name.includes('ELM37'));

      if (!elmDevice) {
        throw new Error('ELM327 device not found');
      }

      const connected = await elmDevice.connect();
      if(connected){
        this.device = elmDevice;
        await this.initializeELM327();
      }
      return true;
    } catch (error) {
      console.error('Failed to connect to ELM327 device', error);
      return false;
    }
  }

  async initializeELM327() {
    const initCommands = [
      'ATE0',     // echo off
      'ATL0',     // linefeeds off
      'ATS0',     // spaces off
      'ATH0',     // headers off
      'ATSP5',    // protocol 5
    ];

    for (const cmd of initCommands) {
      await this.sendCommand(cmd);
    }
  }

  async sendCommand(cmd: string): Promise<string> {
    if (!this.device) {
      throw new Error("Device not connected");
    }
    await this.device.write(cmd + '\r');
    const response = await this.readUntilPrompt();
    return response;
  }

  async readUntilPrompt(prompt = '>') {
    if (!this.device) {
      throw new Error("Device not connected");
    }
    let buffer = '';
    while (true) {
      const data = await this.device.read();
      if (data) {
        buffer += data;
        if (buffer.includes(prompt)) {
          return buffer;
        }
      }
    }
  }

  startPolling(callback: (data: any) => void, numberOfCylinders: number) {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }

    this.pollingInterval = setInterval(async () => {
      const allData: any = {};
      for (const command of commands) {
        const response = await this.sendCommand(command);
        const cleaned = response.replace(/\s/g, '').replace('>', '');
        const responseBytes = Buffer.from(cleaned, 'hex');

        const commandDecoders = decoders[command as keyof typeof decoders];
        for (const decoder of commandDecoders) {
          const start = decoder.startByte;
          const end = start + decoder.numBits / 8;
          const valueBytes = responseBytes.slice(start, end);
          const rawValue = valueBytes.readUInt16BE(0);

          if (decoder.header === 'fuel_per_stroke') {
            allData['fuel_consumption_rate'] = rawValue * numberOfCylinders;
          } else {
            allData[decoder.header] = rawValue;
          }
        }
      }
      callback(allData);
    }, 1000);
  }

  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  async disconnect() {
    this.stopPolling();
    if (this.device) {
      await this.device.disconnect();
      this.device = null;
    }
  }
}

export const obdService = new OBDService();
