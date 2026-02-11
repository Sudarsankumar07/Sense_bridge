import { Camera, CameraCapturedPicture } from 'expo-camera';
import config from '../constants/config';

export const captureFrame = async (cameraRef: Camera | null): Promise<CameraCapturedPicture | null> => {
    if (!cameraRef) return null;

    try {
        const photo = await cameraRef.takePictureAsync({
            base64: true,
            quality: config.CAMERA.QUALITY,
            skipProcessing: true,
        });

        return photo;
    } catch (error) {
        console.error('Camera capture error:', error);
        return null;
    }
};

export const throttle = (lastTime: number, fps: number) => {
    const interval = 1000 / fps;
    const now = Date.now();
    return now - lastTime >= interval;
};
