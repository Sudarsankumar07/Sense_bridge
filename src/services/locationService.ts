import * as Location from 'expo-location';
import config from '../constants/config';

export type LocationCoords = {
    latitude: number;
    longitude: number;
    heading: number | null;
    accuracy: number | null;
};

let locationSubscription: Location.LocationSubscription | null = null;

/**
 * Request foreground location permission.
 */
export const requestLocationPermission = async (): Promise<boolean> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
};

/**
 * Check if device location services (GPS) are enabled.
 */
export const isLocationEnabled = async (): Promise<boolean> => {
    try {
        return await Location.hasServicesEnabledAsync();
    } catch {
        return false;
    }
};

/**
 * Get the current GPS position (one-shot).
 * Automatically requests permission and checks if GPS is enabled.
 */
export const getCurrentLocation = async (): Promise<LocationCoords | null> => {
    try {
        // 1. Request permission first
        const granted = await requestLocationPermission();
        if (!granted) {
            console.warn('[LocationService] Location permission denied');
            return null;
        }

        // 2. Check if location services are enabled on the device
        const enabled = await isLocationEnabled();
        if (!enabled) {
            console.warn('[LocationService] Location services are disabled on this device. Please enable GPS.');
            return null;
        }

        // 3. Try high accuracy first, fall back to balanced
        let location;
        try {
            location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
            });
        } catch {
            console.log('[LocationService] High accuracy failed, trying balanced...');
            location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
        }

        console.log(`[LocationService] Got location: ${location.coords.latitude}, ${location.coords.longitude} (accuracy: ${location.coords.accuracy}m)`);

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            heading: location.coords.heading ?? null,
            accuracy: location.coords.accuracy ?? null,
        };
    } catch (error) {
        console.error('[LocationService] Failed to get current location:', error);
        return null;
    }
};

/**
 * Start continuous GPS tracking. Calls the callback on each position update.
 */
export const startLocationTracking = async (
    callback: (coords: LocationCoords) => void
): Promise<boolean> => {
    try {
        // Stop any existing subscription first
        await stopLocationTracking();

        locationSubscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: config.NAVIGATION.GPS_UPDATE_INTERVAL,
                distanceInterval: config.NAVIGATION.GPS_DISTANCE_FILTER,
            },
            (location) => {
                callback({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    heading: location.coords.heading ?? null,
                    accuracy: location.coords.accuracy ?? null,
                });
            }
        );

        console.log('[LocationService] GPS tracking started');
        return true;
    } catch (error) {
        console.error('[LocationService] Failed to start tracking:', error);
        return false;
    }
};

/**
 * Stop continuous GPS tracking.
 */
export const stopLocationTracking = async (): Promise<void> => {
    if (locationSubscription) {
        locationSubscription.remove();
        locationSubscription = null;
        console.log('[LocationService] GPS tracking stopped');
    }
};

/**
 * Get the current compass heading.
 */
export const getHeading = async (): Promise<number | null> => {
    try {
        const heading = await Location.getHeadingAsync();
        return heading.trueHeading ?? heading.magHeading ?? null;
    } catch (error) {
        console.error('[LocationService] Failed to get heading:', error);
        return null;
    }
};
