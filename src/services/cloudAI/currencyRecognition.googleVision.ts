import { CurrencyDetection, CloudError } from '../../types';
import config from '../../constants/config';
import { GOOGLE_CLOUD_VISION_API_KEY } from '@env';

/**
 * Google Cloud Vision Currency Detection Provider
 * Uses LABEL_DETECTION + TEXT_DETECTION to identify Indian currency denominations.
 */

const API_URL = config.API.GOOGLE_VISION;
const API_KEY = GOOGLE_CLOUD_VISION_API_KEY || '';

// Known Indian currency denominations
const KNOWN_DENOMINATIONS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 2000];

export const detectCurrencyGoogleVision = async (imageBase64: string): Promise<CurrencyDetection | null> => {
    if (!API_KEY) {
        const err: CloudError = {
            source: 'currency_detection',
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
                    { type: 'LABEL_DETECTION', maxResults: 10 },
                    { type: 'TEXT_DETECTION', maxResults: 5 },
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
            source: 'currency_detection',
            provider: 'google',
            httpStatus: response.status,
            message: `Google Vision returned HTTP ${response.status}`,
            timestamp: Date.now(),
        };
        throw err;
    }

    const data = await response.json();
    const resp = data.responses?.[0];

    // Check labels for currency-related keywords
    const labels: string[] = (resp?.labelAnnotations || []).map((l: any) => l.description?.toLowerCase() || '');
    const isCurrency = labels.some(label =>
        label.includes('currency') || label.includes('banknote') ||
        label.includes('money') || label.includes('rupee') || label.includes('coin')
    );

    if (!isCurrency) {
        return null;
    }

    // Extract denomination from detected text
    const textAnnotations = resp?.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || '';

    // Find numbers in the text that match known denominations
    const numbers = fullText.match(/\d+/g) || [];
    let denomination = 0;
    let bestConfidence = 0;

    for (const numStr of numbers) {
        const num = parseInt(numStr);
        if (KNOWN_DENOMINATIONS.includes(num)) {
            denomination = num;
            // Use the highest label confidence as an approximation
            bestConfidence = resp?.labelAnnotations?.[0]?.score || 0.7;
            break;
        }
    }

    if (denomination === 0) {
        return null;
    }

    return {
        denomination,
        currency: 'INR',
        confidence: bestConfidence,
    };
};
