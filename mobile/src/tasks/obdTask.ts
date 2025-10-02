import BackgroundService from 'react-native-background-actions';
import { obdService } from '../services/obd.service';
import { locationService } from '../services/location.service';
import { dataQueue } from '../services/dataQueue.service';

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
            dataQueue.enqueue(dataFrame);
        };

        obdService.startPolling(
            sendDataCallback,
            numberOfCylinders,
            () => {
                const location = locationService.getCurrentLocation();
                return {
                    latitude: location?.coords.latitude,
                    longitude: location?.coords.longitude,
                    altitude: location?.coords.altitude === null ? undefined : location?.coords.altitude,
                };
            },
        );

        while (BackgroundService.isRunning()) {
            await sleep(5000);
        }

        obdService.stopTrip();
        await obdService.stopPolling();
        locationService.stopLocationTracking();
        resolve(null);
    });
};
