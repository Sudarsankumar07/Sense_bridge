import { ObjectDetection, CloudError } from '../../types';
import config from '../../constants/config';
import { ROBOFLOW_API_KEY, ROBOFLOW_OBJECT_MODEL } from '@env';

/**
 * Roboflow Object Detection Provider
 */

const API_URL = config.API.OBJECT_DETECTION;
const API_KEY = ROBOFLOW_API_KEY || '';
const MODEL_ID = ROBOFLOW_OBJECT_MODEL || 'obstacle-detection-yp5nu/4';

export const detectObjectsRoboflow = async (imageBase64: string): Promise<ObjectDetection[]> => {
    if (!API_KEY) {
        const err: CloudError = {
            source: 'object_detection',
            provider: 'roboflow',
            message: 'ROBOFLOW_API_KEY is missing. Set it in your .env file.',
            timestamp: Date.now(),
        };
        throw err;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const url = new URL(`${API_URL}/${MODEL_ID}`);
    url.searchParams.append('api_key', API_KEY);

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageBase64 }),
        signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const err: CloudError = {
            source: 'object_detection',
            provider: 'roboflow',
            httpStatus: response.status,
            message: `Roboflow returned HTTP ${response.status}`,
            timestamp: Date.now(),
        };
        throw err;
    }

    const data = await response.json();

    if (!data.predictions) {
        return [];
    }

    const detections: ObjectDetection[] = data.predictions.map((detection: any) => ({
        class: detection.class,
        confidence: detection.confidence,
        boundingBox: {
            x: detection.x - detection.width / 2,
            y: detection.y - detection.height / 2,
            width: detection.width,
            height: detection.height,
        },
        distance: estimateDistance({ width: detection.width, height: detection.height }),
    }));

    return detections.filter(d => d.confidence >= config.DETECTION.CONFIDENCE_THRESHOLD);
};

const estimateDistance = (box: { width: number; height: number }): number => {
    const boxArea = box.width * box.height;
    const normalizedArea = boxArea / 10000;
    const estimatedDistance = Math.max(0.5, 5 - normalizedArea * 4);
    return parseFloat(estimatedDistance.toFixed(1));
};
