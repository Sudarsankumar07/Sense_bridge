import { CurrencyDetection, CloudError } from '../../types';
import { CLOUD_PROVIDER } from '@env';
import config from '../../constants/config';
import { detectCurrencyRoboflow } from './currencyRecognition.roboflow';
import { detectCurrencyGoogleVision } from './currencyRecognition.googleVision';

/**
 * Currency Recognition Service – Provider Selector
 *
 * Routes to Roboflow or Google Vision based on CLOUD_PROVIDER env variable.
 * Maintains majority-voting buffer regardless of provider.
 * Throws CloudError on failures instead of returning mock data.
 */

const provider = (CLOUD_PROVIDER || 'roboflow').toLowerCase();

console.log(`[SenseBridge] Currency Detection provider: ${provider}`);

// Majority voting buffer
let detectionBuffer: number[] = [];

export const detectCurrency = async (imageBase64: string): Promise<CurrencyDetection | null> => {
    let raw: CurrencyDetection | null;

    if (provider === 'google') {
        raw = await detectCurrencyGoogleVision(imageBase64);
    } else {
        raw = await detectCurrencyRoboflow(imageBase64);
    }

    if (!raw) return null;

    // Add to buffer for majority voting
    detectionBuffer.push(raw.denomination);
    if (detectionBuffer.length > config.DETECTION.FRAMES_FOR_CURRENCY) {
        detectionBuffer.shift();
    }

    // Get majority vote
    const finalDenomination = getMajorityVote(detectionBuffer);

    return {
        denomination: finalDenomination,
        currency: raw.currency,
        confidence: raw.confidence,
    };
};

/**
 * Get majority vote from buffer
 */
const getMajorityVote = (buffer: number[]): number => {
    if (buffer.length === 0) return 0;

    const counts: { [key: number]: number } = {};
    buffer.forEach(val => {
        counts[val] = (counts[val] || 0) + 1;
    });

    let maxCount = 0;
    let majorityValue = buffer[0];
    Object.entries(counts).forEach(([value, count]) => {
        if (count > maxCount) {
            maxCount = count;
            majorityValue = parseInt(value);
        }
    });

    return majorityValue;
};

/**
 * Reset detection buffer
 */
export const resetCurrencyBuffer = () => {
    detectionBuffer = [];
};
