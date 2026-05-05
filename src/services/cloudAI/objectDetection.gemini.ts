import { ObjectDetection, CloudError } from '../../types';
import config from '../../constants/config';
import { GEMINI_API_KEY } from '@env';

/**
 * Gemini Vision Object Detection Provider
 *
 * Uses Gemini 1.5 Flash to detect objects and estimate distances.
 * Returns the same ObjectDetection[] shape as the Google Vision provider
 * so the rest of the app (BlindModeScreen, decisionEngine) is unchanged.
 *
 * Free tier: 15 requests/minute, 1M tokens/day — no billing required.
 */

const API_URL = config.API.GEMINI_VISION;
const API_KEY = GEMINI_API_KEY || '';

const PROMPT = `You are an obstacle detection assistant helping a blind person navigate safely.
Analyze this image and respond ONLY with a valid JSON array — no markdown, no explanation, nothing else.
Each item in the array must have exactly these fields:
  "class"      : string  (name of the object, e.g. "Chair", "Person", "Car")
  "confidence" : number  (0.0 to 1.0 — how sure you are)
  "distance_m" : number  (estimated distance in metres from the camera)
List a maximum of 5 objects, ordered by proximity (closest first).
If no significant obstacles are visible, return an empty array: []
Example output:
[{"class":"Chair","confidence":0.92,"distance_m":1.2},{"class":"Table","confidence":0.85,"distance_m":2.0}]`;

export const detectObjectsGemini = async (imageBase64: string): Promise<ObjectDetection[]> => {
    if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
        const err: CloudError = {
            source: 'object_detection',
            provider: 'gemini',
            message: 'GEMINI_API_KEY is missing. Add it to your .env file (get a free key at aistudio.google.com).',
            timestamp: Date.now(),
        };
        throw err;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const requestBody = {
        contents: [
            {
                parts: [
                    { text: PROMPT },
                    {
                        inline_data: {
                            mime_type: 'image/jpeg',
                            data: imageBase64,
                        },
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.1,   // low temp = deterministic, structured output
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
        },
    };

    let response: Response;
    try {
        response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
    } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        const err: CloudError = {
            source: 'object_detection',
            provider: 'gemini',
            message: fetchErr?.name === 'AbortError' ? 'Gemini request timed out (15s)' : fetchErr?.message ?? 'Network error',
            timestamp: Date.now(),
        };
        throw err;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
        const err: CloudError = {
            source: 'object_detection',
            provider: 'gemini',
            httpStatus: response.status,
            message: `Gemini returned HTTP ${response.status}`,
            timestamp: Date.now(),
        };
        throw err;
    }

    const data = await response.json();

    // Extract the text content from Gemini's response
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Parse JSON
    let parsed: any[];
    try {
        parsed = JSON.parse(rawText);
        if (!Array.isArray(parsed)) parsed = [];
    } catch {
        console.warn('[Gemini] Could not parse response as JSON:', rawText.slice(0, 200));
        return [];
    }

    // Map to ObjectDetection[] (same shape as Google Vision provider)
    const detections: ObjectDetection[] = parsed
        .filter((item: any) => item && typeof item.class === 'string')
        .map((item: any) => ({
            class: item.class ?? 'Unknown',
            confidence: typeof item.confidence === 'number' ? item.confidence : 0.7,
            boundingBox: { x: 0, y: 0, width: 0, height: 0 }, // Gemini doesn't give bounding boxes
            distance: typeof item.distance_m === 'number' ? item.distance_m : undefined,
        }));

    return detections.filter(d => d.confidence >= config.DETECTION.CONFIDENCE_THRESHOLD);
};
