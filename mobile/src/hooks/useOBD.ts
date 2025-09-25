import { useState, useEffect, useCallback } from 'react';
import { obdService } from '../services/obd.service';
import { webSocketService } from '../services/WebSocketService';
import { Buffer } from 'buffer';

export const useOBD = (
  tripStatus: 'stopped' | 'ongoing' | 'paused',
  numberOfCylinders: number,
) => {
  const [obdData, setObdData] = useState<any>(null);

  const sendDataToServer = useCallback((data: Buffer) => {
    webSocketService.sendDataFrames([data]);
  }, []);

  useEffect(() => {
    if (numberOfCylinders > 0) {
      if (tripStatus === 'ongoing') {
        obdService.startTrip();
        obdService.startPolling(
          setObdData,
          sendDataToServer,
          numberOfCylinders,
        );
      } else {
        obdService.stopTrip();
        // Polling is kept alive to send tester present command
        // but we can stop it completely if trip is stopped
        if (tripStatus === 'stopped') {
          obdService.stopPolling();
        }
      }
    }

    // Cleanup polling on component unmount
    return () => {
      obdService.stopPolling();
    };
  }, [tripStatus, numberOfCylinders, sendDataToServer]);

  return {
    obdData,
  };
};