import BackgroundService from 'react-native-background-actions';
import { obdService } from '../services/obd.service';
import { locationService } from '../services/location.service';
import { webSocketService } from '../services/WebSocketService';
import { Buffer } from 'buffer';

const sleep = (time: number) => new Promise((resolve) => setTimeout(() => resolve(null), time));

export const obdTask = async (taskParameters?: { numberOfCylinders: number }) => {
    if (!taskParameters) {
        return;
    }

    const { numberOfCylinders } = taskParameters;

    await new Promise(async (resolve) => {
        locationService.startLocationTracking();

        while (locationService.getCurrentLocation() === null) {
            if (!BackgroundService.isRunning()) {
                locationService.stopLocationTracking();
                return resolve(null);
            }
            await sleep(1000);
        }

        obdService.startTrip();

        const sendDataCallback = (dataFrame: Buffer) => {
            if (webSocketService.isConnected()) {
                webSocketService.sendDataFrames([dataFrame]);
            }
        };

        obdService.startPolling(
            sendDataCallback,
            numberOfCylinders,
            () => {
                const location = locationService.getCurrentLocation();
                return {
                    latitude: location?.coords.latitude,
                    longitude: location?.coords.longitude,
                    altitude: location?.coords.altitude,
                };
            },
        );

        while (BackgroundService.isRunning()) {
            await sleep(5000);
        }

        obdService.stopTrip();
        obdService.stopPolling();
        locationService.stopLocationTracking();
        resolve(null);
    });
};
