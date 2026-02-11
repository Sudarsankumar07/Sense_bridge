import { ObjectDetection } from '../../types';
import config from '../../constants/config';

/**
 * Object Detection Service
 * For Expo Go: mock detections.
 * For native build: replace with on-device inference.
 */

const API_URL = config.API.OBJECT_DETECTION;
const API_KEY = process.env.HUGGING_FACE_API_KEY || 'demo';

export const detectObjects = async (imageBase64: string): Promise<ObjectDetection[]> => {
    try {
        if (API_KEY === 'demo') {
            return getMockObjectDetection();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ inputs: imageBase64 }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        const detections: ObjectDetection[] = data.map((detection: any) => ({
            class: detection.label,
            confidence: detection.score,
            boundingBox: detection.box,
            distance: estimateDistance(detection.box),
        }));

        return detections.filter(d => d.confidence >= config.DETECTION.CONFIDENCE_THRESHOLD);
    } catch (error) {
        console.error('Object detection error:', error);
        return getMockObjectDetection();
    }
};

const estimateDistance = (box: any): number => {
    const boxArea = box.width * box.height;
    const normalizedArea = boxArea / 10000;
    const estimatedDistance = Math.max(0.5, 5 - normalizedArea * 4);
    return parseFloat(estimatedDistance.toFixed(1));
};

const getMockObjectDetection = (): ObjectDetection[] => {
    const mockObjects = [
        { class: 'person', distance: 2.2 },
        { class: 'chair', distance: 1.6 },
        { class: 'door', distance: 3.4 },
        { class: 'stairs', distance: 1.2 },
        { class: 'table', distance: 2.8 },
    ];

    const randomObject = mockObjects[Math.floor(Math.random() * mockObjects.length)];

    return [
        {
            class: randomObject.class,
            confidence: 0.85 + Math.random() * 0.1,
            boundingBox: {
                x: 100,
                y: 100,
                width: 200,
                height: 200,
            },
            distance: randomObject.distance,
        },
    ];
};
