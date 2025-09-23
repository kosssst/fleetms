import { useState, useEffect } from 'react';
import { obdService } from '../services/obd.service';
import { Alert } from 'react-native';
import { Buffer } from 'buffer';
import { webSocketService } from '../services/WebSocketService';

export const useOBD = (tripStatus: 'stopped' | 'ongoing' | 'paused', numberOfCylinders: number) => {
  const [isConnected, setIsConnected] = useState(false);
  const [obdData, setObdData] = useState<any>(null);

  const connectToDevice = async () => {
    const success = await obdService.connectToDevice();
    setIsConnected(success);
    if (!success) {
      Alert.alert('Connection Failed', 'Could not connect to ELM327 device.');
    }
  };

  useEffect(() => {
    if (tripStatus === 'ongoing') {
      obdService.startPolling(setObdData, numberOfCylinders);
    } else {
      obdService.stopPolling();
    }
  }, [tripStatus, numberOfCylinders]);

  useEffect(() => {
    if (tripStatus === 'ongoing' && obdData) {
      const dataFrame = Buffer.alloc(32);
      dataFrame.writeBigUInt64BE(BigInt(new Date().getTime()), 0);
      // Populate the rest of the data frame with real obdData...
      dataFrame.writeUInt16BE(obdData.vehicle_speed || 0, 20);
      dataFrame.writeUInt16BE(obdData.engine_speed || 0, 22);
      dataFrame.writeUInt16BE(obdData.accelerator_position || 0, 24);
      dataFrame.writeUInt16BE(obdData.engine_coolant_temp || 0, 26);
      dataFrame.writeUInt16BE(obdData.intake_air_temp || 0, 28);
      dataFrame.writeUInt16BE(obdData.fuel_consumption_rate || 0, 30);

      webSocketService.sendDataFrames([dataFrame]);
    }
  }, [obdData, tripStatus]);

  return {
    isConnected,
    obdData,
    connectToDevice,
    disconnectFromDevice: obdService.disconnect,
  };
};
