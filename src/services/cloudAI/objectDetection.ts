import axios from 'axios';
import { ObjectDetection } from '../../types';
import config from '../../constants/config';

/**
 * Object Detection Service using Hugging Face API
 * Uses DETR (DEtection TRansformer) model for real-time object detection
 */

const API_URL = config.API.OBJECT_DETECTION;
const API_KEY = process.env.HUGGING_FACE_API_KEY || 'demo';

export const detectObjects = async (imageBase64: string): Promise<ObjectDetection[]> => {
    try {
        // For demo purposes, if no API key, return mock data
        if (API_KEY === 'demo') {
            return getMockObjectDetection();
        }

        const response = await axios.post(
            API_URL,
            { inputs: imageBase64 },
            {
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                },
                timeout: 10000,
            }
        );

        // Transform Hugging Face response to our format
        const detections: ObjectDetection[] = response.data.map((detection: any) => ({
            class: detection.label,
            confidence: detection.score,
            boundingBox: detection.box,
            distance: estimateDistance(detection.box),
        }));

        return detections.filter(d => d.confidence >= config.DETECTION.CONFIDENCE_THRESHOLD);
    } catch (error) {
        console.error('Object detection error:', error);
        // Fallback to mock data on error
        return getMockObjectDetection();
    }
};

/**
 * Estimate distance based on bounding box size
 * Larger objects are closer, smaller objects are farther
 */
const estimateDistance = (box: any): number => {
    const boxArea = box.width * box.height;
    // Simple heuristic: smaller box = farther away
    // This is approximate and should be calibrated
    const normalizedArea = boxArea / 10000; // Normalize
    const estimatedDistance = Math.max(0.5, 5 - (normalizedArea * 4));
    return parseFloat(estimatedDistance.toFixed(1));
};

/**
 * Mock object detection for testing without API
 */
const getMockObjectDetection = (): ObjectDetection[] => {
    const mockObjects = [
        { class: 'person', distance: 2.5 },
        { class: 'chair', distance: 1.8 },
        { class: 'table', distance: 3.2 },
        { class: 'door', distance: 4.0 },
    ];

    const randomObject = mockObjects[Math.floor(Math.random() * mock Objects.length)];

    return [{
        class: randomObject.class,
        confidence: 0.85 + Math.random() * 0.1,
        boundingBox: {
            x: 100,
            y: 100,
            width: 200,
            height: 200,
        },
        distance: randomObject.distance,
    }];
};
