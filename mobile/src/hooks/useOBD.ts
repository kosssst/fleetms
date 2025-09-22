import { useState, useEffect, useRef } from 'react';
import { obdService } from '../services/obd.service';
import { Alert } from 'react-native';
import { Buffer } from 'buffer';

const WEBSOCKET_URL = 'ws://localhost:8000'; // This should be in an env file

// Helper to log buffer data as hex
const logHex = (prefix: string, data: Buffer | ArrayBuffer) => {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  console.log(`${prefix} ${buffer.toString('hex').toUpperCase()}`);
};

export const useOBD = (token: string, numberOfCylinders: number) => {
  const [isConnected, setIsConnected] = useState(false);
  const [obdData, setObdData] = useState<any>(null);
  const [tripStatus, setTripStatus] = useState<'stopped' | 'ongoing' | 'paused'>('stopped');
  const ws = useRef<WebSocket | null>(null);
  const tripId = useRef<string | null>(null);

  const connectToDevice = async () => {
    const success = await obdService.connectToDevice();
    setIsConnected(success);
    if (!success) {
      Alert.alert('Connection Failed', 'Could not connect to ELM327 device.');
    }
  };

  const connectWebSocket = () => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected.');
      return;
    }

    ws.current = new WebSocket(`${WEBSOCKET_URL}?token=${token}`);
    ws.current.binaryType = 'arraybuffer'; // Important for receiving binary data

    ws.current.onopen = () => {
      console.log('WS: ==> Connection opened');
      // Authenticate
      const tokenBytes = Buffer.from(token, 'utf-8');
      const header = Buffer.from([0x00]); // AUTH_REQ
      const length = Buffer.alloc(2);
      length.writeUInt16BE(tokenBytes.length, 0);
      const message = Buffer.concat([header, length, tokenBytes]);
      logHex('WS: ==> Sending AUTH_REQ:', message);
      ws.current?.send(message);
    };

    ws.current.onmessage = (event) => {
      const data = Buffer.from(event.data);
      logHex('WS: <== Received message:', data);
      const header = data.readUInt8(0);
      const commandType = (header >> 2) & 0x3F;

      if (commandType === 0x01) { // AUTH_OK
        console.log('WS: <== AUTH_OK received');
      } else if (commandType === 0x03) { // START_TRIP_OK
        const tripIdLength = data.readUInt16BE(1);
        const tripIdHex = data.slice(3, 3 + tripIdLength).toString('hex');
        tripId.current = tripIdHex;
        console.log(`WS: <== START_TRIP_OK received. Trip ID: ${tripIdHex}`);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WS: ==> Error:', error);
    };

    ws.current.onclose = (event) => {
      console.log(`WS: ==> Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
    };
  };

  const startTrip = () => {
    connectWebSocket();
    const message = Buffer.from([0x02]); // START_TRIP_REQ
    logHex('WS: ==> Sending START_TRIP_REQ:', message);
    ws.current?.send(message);
    setTripStatus('ongoing');
    obdService.startPolling(setObdData, numberOfCylinders);
  };

  const pauseTrip = () => {
    const message = Buffer.from([0x0C]); // PAUSE_TRIP_REQ
    logHex('WS: ==> Sending PAUSE_TRIP_REQ:', message);
    ws.current?.send(message);
    setTripStatus('paused');
    obdService.stopPolling();
  };

  const resumeTrip = () => {
    if (!tripId.current) {
      Alert.alert('Error', 'Cannot resume trip without a trip ID.');
      return;
    }
    const tripIdBytes = Buffer.from(tripId.current, 'hex');
    const header = Buffer.from([0x04]); // RESUME_TRIP_REQ
    const length = Buffer.alloc(2);
    length.writeUInt16BE(tripIdBytes.length, 0);
    const message = Buffer.concat([header, length, tripIdBytes]);
    logHex('WS: ==> Sending RESUME_TRIP_REQ:', message);
    ws.current?.send(message);
    setTripStatus('ongoing');
    obdService.startPolling(setObdData, numberOfCylinders);
  };

  const endTrip = () => {
    const message = Buffer.from([0x06]); // END_TRIP_REQ
    logHex('WS: ==> Sending END_TRIP_REQ:', message);
    ws.current?.send(message);
    setTripStatus('stopped');
    obdService.stopPolling();
    ws.current?.close();
  };

  useEffect(() => {
    if (tripStatus === 'ongoing' && obdData) {
      // This is a simplified version. The actual implementation should buffer the data
      // and send it in batches as per the protocol.
      const dataFrame = Buffer.alloc(32);
      dataFrame.writeBigUInt64BE(BigInt(new Date().getTime()), 0);
      // Populate the rest of the data frame with real obdData...
      // For now, sending mostly empty data for demonstration
      dataFrame.writeUInt16BE(obdData.vehicle_speed || 0, 20);
      dataFrame.writeUInt16BE(obdData.engine_speed || 0, 22);
      dataFrame.writeUInt16BE(obdData.fuel_consumption_rate || 0, 30);

      const header = Buffer.from([0x41]); // DATA frame with 1 record (01000001)
      const message = Buffer.concat([header, dataFrame]);
      logHex('WS: ==> Sending DATA:', message);
      ws.current?.send(message);
    }
  }, [obdData, tripStatus]);

  return {
    isConnected,
    obdData,
    tripStatus,
    connectToDevice,
    disconnectFromDevice: obdService.disconnect,
    startTrip,
    pauseTrip,
    resumeTrip,
    endTrip,
  };
};
