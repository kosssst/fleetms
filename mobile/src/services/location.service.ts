import Geolocation, { GeoPosition } from 'react-native-geolocation-service';
import { PermissionsAndroid, Platform } from 'react-native';

class LocationService {
    private static instance: LocationService;
    private watchId: number | null = null;
    private latestLocation: GeoPosition | null = null;

    private constructor() {}

    public static getInstance(): LocationService {
        if (!LocationService.instance) {
            LocationService.instance = new LocationService();
        }
        return LocationService.instance;
    }

    public async requestLocationPermission(): Promise<boolean> {
        if (Platform.OS === 'ios') {
            const status = await Geolocation.requestAuthorization('whenInUse');
            return status === 'granted';
        }

        if (Platform.OS === 'android') {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: 'Location Permission',
                    message: 'This app needs access to your location to track your trips.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                },
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }

        return false;
    }

    public startLocationTracking(): void {
        if (this.watchId !== null) {
            console.log('Location tracking already started.');
            return;
        }

        this.watchId = Geolocation.watchPosition(
            (position) => {
                this.latestLocation = position;
                console.log('New location:', position);
            },
            (error) => {
                console.log(error.code, error.message);
            },
            {
                enableHighAccuracy: true,
                interval: 5000,
                fastestInterval: 2000,
                distanceFilter: 10,
                showLocationDialog: true,
            },
        );
    }

    public stopLocationTracking(): void {
        if (this.watchId !== null) {
            Geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    public getCurrentLocation(): GeoPosition | null {
        return this.latestLocation;
    }
}

export const locationService = LocationService.getInstance();
