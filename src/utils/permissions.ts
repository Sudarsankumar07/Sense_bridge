import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';

export type PermissionState = {
    camera: boolean;
    microphone: boolean;
    location: boolean;
};

export const requestPermissions = async (): Promise<PermissionState> => {
    const cameraStatus = await Camera.requestCameraPermissionsAsync();
    const micStatus = await Audio.requestPermissionsAsync();
    const locationStatus = await Location.requestForegroundPermissionsAsync();

    return {
        camera: cameraStatus.status === 'granted',
        microphone: micStatus.status === 'granted',
        location: locationStatus.status === 'granted',
    };
};

export const checkPermissions = async (): Promise<PermissionState> => {
    const cameraStatus = await Camera.getCameraPermissionsAsync();
    const micStatus = await Audio.getPermissionsAsync();
    const locationStatus = await Location.getForegroundPermissionsAsync();

    return {
        camera: cameraStatus.status === 'granted',
        microphone: micStatus.status === 'granted',
        location: locationStatus.status === 'granted',
    };
};
