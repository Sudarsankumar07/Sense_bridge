import { CurrencyDetection, CloudError } from '../../types';
import config from '../../constants/config';
import { ROBOFLOW_API_KEY, ROBOFLOW_CURRENCY_MODEL } from '@env';

/**
 * Roboflow Currency Detection Provider
 */

const API_URL = config.API.CURRENCY_DETECTION;
const API_KEY = ROBOFLOW_API_KEY || '';
const MODEL_ID = ROBOFLOW_CURRENCY_MODEL || 'indian-currency';

export const detectCurrencyRoboflow = async (imageBase64: string): Promise<CurrencyDetection | null> => {
    if (!API_KEY) {
        const err: CloudError = {
            source: 'currency_detection',
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
            source: 'currency_detection',
            provider: 'roboflow',
            httpStatus: response.status,
            message: `Roboflow returned HTTP ${response.status}`,
            timestamp: Date.now(),
        };
        throw err;
    }

    const data = await response.json();

    if (data.predictions && data.predictions.length > 0) {
        const prediction = data.predictions[0];
        const denomination = parseDenomination(prediction.class);

        return {
            denomination,
            currency: 'INR',
            confidence: prediction.confidence,
        };
    }

    return null;
};

const parseDenomination = (className: string): number => {
    const match = className.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
};
