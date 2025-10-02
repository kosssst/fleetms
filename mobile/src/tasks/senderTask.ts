import BackgroundService from 'react-native-background-actions';
import { dataQueue } from '../services/dataQueue.service';
import { webSocketService } from '../services/WebSocketService';

const sleep = (time: number) => new Promise((resolve) => setTimeout(() => resolve(null), time));

export const senderTask = async () => {
    await new Promise(async (resolve) => {
        while (BackgroundService.isRunning()) {
            if (!dataQueue.isEmpty()) {
                const dataFrame = dataQueue.dequeue();
                if (dataFrame) {
                    webSocketService.sendDataFrames([dataFrame]);
                }
            }
            await sleep(100);
        }
        resolve(null);
    });
};
