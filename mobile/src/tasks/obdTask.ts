import BackgroundService from 'react-native-background-actions';
import { obdService } from '../services/obd.service';
import { webSocketService } from '../services/WebSocketService';

const sleep = (time: number) => new Promise((resolve) => setTimeout(() => resolve(null), time));

export const obdTask = async (taskDataArguments?: { numberOfCylinders: number }) => {
    if (!taskDataArguments) {
        return;
    }

    const { numberOfCylinders } = taskDataArguments;

    await new Promise(async (resolve) => {
        obdService.startTrip();

        const dataCallback = (data: any) => {
            // We can potentially update the notification with live data here
            // For now, we just log it.
            console.log('OBD Data:', data);
        };

        const sendDataCallback = (dataFrame: Buffer) => {
            if (webSocketService.isConnected()) {
                webSocketService.sendDataFrames([dataFrame]);
            }
        };

        obdService.startPolling(dataCallback, sendDataCallback, numberOfCylinders);

        while (BackgroundService.isRunning()) {
            await sleep(2000);
        }

        obdService.stopTrip();
        obdService.stopPolling();
        resolve(null);
    });
};
