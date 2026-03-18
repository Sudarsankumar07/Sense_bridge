import { ObjectDetection, CloudError } from '../../types';
import config from '../../constants/config';
import { GOOGLE_CLOUD_VISION_API_KEY } from '@env';

/**
 * Google Cloud Vision Object Detection Provider
 * Uses OBJECT_LOCALIZATION to detect objects and their bounding boxes.
 */

const API_URL = config.API.GOOGLE_VISION;
const API_KEY = GOOGLE_CLOUD_VISION_API_KEY || '';

export const detectObjectsGoogleVision = async (imageBase64: string): Promise<ObjectDetection[]> => {
    if (!API_KEY) {
        const err: CloudError = {
            source: 'object_detection',
            provider: 'google',
            message: 'GOOGLE_CLOUD_VISION_API_KEY is missing. Set it in your .env file.',
            timestamp: Date.now(),
        };
        throw err;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const requestBody = {
        requests: [
            {
                image: { content: imageBase64 },
                features: [
                    { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
                ],
            },
        ],
    };

    const response = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
        const err: CloudError = {
            source: 'object_detection',
            provider: 'google',
            httpStatus: response.status,
            message: `Google Vision returned HTTP ${response.status}`,
            timestamp: Date.now(),
        };
        throw err;
    }

    const data = await response.json();

    const annotations = data.responses?.[0]?.localizedObjectAnnotations;
    if (!annotations || annotations.length === 0) {
        return [];
    }

    const detections: ObjectDetection[] = annotations.map((obj: any) => {
        // Google Vision returns normalized bounding polygon vertices (0..1)
        const vertices = obj.boundingPoly?.normalizedVertices || [];
        const x = (vertices[0]?.x || 0) * 1000; // scale to pixel-like coords
        const y = (vertices[0]?.y || 0) * 1000;
        const x2 = (vertices[2]?.x || 0) * 1000;
        const y2 = (vertices[2]?.y || 0) * 1000;
        const width = x2 - x;
        const height = y2 - y;

        return {
            class: obj.name || 'Unknown',
            confidence: obj.score || 0,
            boundingBox: { x, y, width, height },
            distance: estimateDistance({ width, height }),
        };
    });

    return detections.filter(d => d.confidence >= config.DETECTION.CONFIDENCE_THRESHOLD);
};

const estimateDistance = (box: { width: number; height: number }): number => {
    const boxArea = box.width * box.height;
    const normalizedArea = boxArea / 10000;
    const estimatedDistance = Math.max(0.5, 5 - normalizedArea * 4);
    return parseFloat(estimatedDistance.toFixed(1));
};
