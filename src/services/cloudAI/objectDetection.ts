import { ObjectDetection, CloudError } from '../../types';
import { CLOUD_PROVIDER } from '@env';
import { detectObjectsRoboflow } from './objectDetection.roboflow';
import { detectObjectsGoogleVision } from './objectDetection.googleVision';

/**
 * Object Detection Service – Provider Selector
 *
 * Routes to Roboflow or Google Vision based on the CLOUD_PROVIDER env variable.
 * Throws CloudError on failures instead of returning silent empty arrays.
 */

const provider = (CLOUD_PROVIDER || 'roboflow').toLowerCase();

// Log selected provider at module load (startup)
console.log(`[SenseBridge] Object Detection provider: ${provider}`);

export const detectObjects = async (imageBase64: string): Promise<ObjectDetection[]> => {
    if (provider === 'google') {
        return detectObjectsGoogleVision(imageBase64);
    }
    return detectObjectsRoboflow(imageBase64);
};
