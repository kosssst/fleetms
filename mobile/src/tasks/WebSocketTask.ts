import BackgroundActions from 'react-native-background-actions';
import { webSocketService } from '../services/WebSocketService';

const sleep = (time: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), time));

const webSocketTask = async (taskData?: any) => {
    if (!taskData) {
        return;
    }
    await new Promise<void>(async (resolve) => {
        const { token } = taskData;
        webSocketService.connect(token);

        while (BackgroundActions.isRunning()) {
            if (webSocketService.getStatus() === 'disconnected' && !webSocketService.isDisconnectIntentional()) {
                webSocketService.connect(token);
            }
            await sleep(5000);
        }

        resolve();
    });
};

export default webSocketTask;
