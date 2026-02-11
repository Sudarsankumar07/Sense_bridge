import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';

export type PermissionState = {
    camera: boolean;
    microphone: boolean;
};

export const requestPermissions = async (): Promise<PermissionState> => {
    const cameraStatus = await Camera.requestCameraPermissionsAsync();
    const micStatus = await Audio.requestPermissionsAsync();

    return {
        camera: cameraStatus.status === 'granted',
        microphone: micStatus.status === 'granted',
    };
};

export const checkPermissions = async (): Promise<PermissionState> => {
    const cameraStatus = await Camera.getCameraPermissionsAsync();
    const micStatus = await Audio.getPermissionsAsync();

    return {
        camera: cameraStatus.status === 'granted',
        microphone: micStatus.status === 'granted',
    };
};
