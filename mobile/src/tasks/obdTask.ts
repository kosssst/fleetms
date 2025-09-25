import BackgroundService from 'react-native-background-actions';

// You can do anything in your task such as network requests, timers and so on,
// as long as it doesn't touch UI. That's amazing!
const sleep = (time: number) => new Promise((resolve) => setTimeout(() => resolve(null), time));

export const obdTask = async (_taskDataArguments: any) => {
    await new Promise(async (_resolve) => {
        // This loop is what keeps the service alive.
        // The actual work (polling, keep-alive) is handled by timers inside obd.service.ts,
        // so this loop can be very simple.
        for (let i = 0; BackgroundService.isRunning(); i++) {
            await sleep(2000); // Sleep for 2 seconds
        }
    });
};
