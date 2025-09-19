import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LOCATION_TASK_NAME = 'background-location-task';
const LATEST_LOCATION_KEY = 'latest_location';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations.length > 0) {
      const latestLocation = locations[locations.length - 1];
      try {
        await AsyncStorage.setItem(LATEST_LOCATION_KEY, JSON.stringify(latestLocation));
      } catch (e) {
        console.error('Failed to save location to AsyncStorage:', e);
      }
    }
  }
});
