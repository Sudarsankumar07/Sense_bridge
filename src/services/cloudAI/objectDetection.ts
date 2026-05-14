import { ObjectDetection } from '../../types';
import { CLOUD_PROVIDER } from '@env';
import { detectObjectsRoboflow } from './objectDetection.roboflow';
import { detectObjectsGoogleVision } from './objectDetection.googleVision';
import { detectObjectsGemini } from './objectDetection.gemini';

/**
 * Object Detection Service – Provider Selector
 *
 * Routes to Google Vision or Roboflow based on:
 *   1. The runtime provider set via setProvider() (from the in-app toggle)
 *   2. Fallback: the CLOUD_PROVIDER environment variable
 *
 * DEFAULT provider is always 'google' (Google Cloud Vision API).
 * Gemini is NOT used for object detection or currency recognition.
 * Throws CloudError on failures instead of returning silent empty arrays.
 */

export type DetectionProvider = 'roboflow' | 'google' | 'gemini';

// Runtime provider — starts from .env (must be 'google' or 'roboflow')
// Gemini is excluded from object/currency detection; Google Cloud is the primary API.
let runtimeProvider: DetectionProvider =
    ((CLOUD_PROVIDER || 'google').toLowerCase() as DetectionProvider) === 'gemini'
        ? 'google'   // Never let gemini be the default for vision APIs
        : ((CLOUD_PROVIDER || 'google').toLowerCase() as DetectionProvider);

/** Call this from the UI toggle to switch providers at runtime without a reload. */
export const setDetectionProvider = (p: DetectionProvider) => {
    runtimeProvider = p;
    console.log(`[SenseBridge] Object Detection provider switched to: ${p}`);
};

export const getDetectionProvider = (): DetectionProvider => runtimeProvider;

// Log active provider at module load — should always be 'google' or 'roboflow'
console.log(`[SenseBridge] Object Detection startup provider: ${runtimeProvider} (Google Cloud Vision API)`);

export const detectObjects = async (imageBase64: string): Promise<ObjectDetection[]> => {
    switch (runtimeProvider) {
        case 'google':
            return detectObjectsGoogleVision(imageBase64);
        case 'roboflow':
            return detectObjectsRoboflow(imageBase64);
        default:
            // Fallback: always use Google Cloud Vision (never Gemini for vision)
            return detectObjectsGoogleVision(imageBase64);
    }
};
