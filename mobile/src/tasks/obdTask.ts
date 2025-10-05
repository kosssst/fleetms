import BackgroundService from 'react-native-background-actions';
import { obdService } from '../services/obd.service';
import { locationService } from '../services/location.service';
import { dataQueue } from '../services/dataQueue.service';
import { webSocketService } from '../services/WebSocketService';
import { wakeLock } from '../native/WakeLock';

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

type ObdTaskParams = {
  numberOfCylinders: number;
  authToken?: string;
};

export const obdTask = async (params?: ObdTaskParams) => {
  if (!params) return;
  const { numberOfCylinders, authToken } = params;

  await new Promise<void>(async (resolve) => {
    try {
      // Keep CPU running for the whole trip
      try { await wakeLock.acquire(); } catch {}

      // Location + socket
      locationService.startLocationTracking();
      webSocketService.connect(msg => console.log(msg));
      if (authToken) webSocketService.authenticate(authToken);

      while (BackgroundService.isRunning() && !webSocketService.isConnected()) {
        await sleep(300);
      }
      if (!BackgroundService.isRunning()) return resolve();

      // Start OBD trip + ticker polling (native timer inside service)
      obdService.startTrip();

      const sendDataCallback = (frame: Buffer) => dataQueue.enqueue(frame);
      obdService.startPolling(
        sendDataCallback,
        numberOfCylinders,
        () => {
          const loc = locationService.getCurrentLocation();
          return {
            latitude:  loc?.coords.latitude,
            longitude: loc?.coords.longitude,
            altitude:  loc?.coords.altitude ?? undefined,
          };
        },
      );

      // Sender loop
      while (BackgroundService.isRunning()) {
        const batch: Buffer[] = [];
        while (!dataQueue.isEmpty() && batch.length < 63) {
          const f = dataQueue.dequeue(); if (!f) break; batch.push(f);
        }
        if (batch.length) webSocketService.sendDataFrames(batch);
        await sleep(batch.length ? 60 : 150);
      }
    } catch (err) {
      console.warn('[obdTask] error:', err);
    } finally {
      try { await obdService.stopPolling(); } catch {}
      try { obdService.stopTrip(); } catch {}
      try { locationService.stopLocationTracking(); } catch {}
      try { if (await wakeLock.isHeld()) await wakeLock.release(); } catch {}
      resolve();
    }
  });
};
