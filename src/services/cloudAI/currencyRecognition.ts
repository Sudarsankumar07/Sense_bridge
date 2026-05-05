import { CurrencyDetection } from '../../types';
import config from '../../constants/config';
import { detectCurrencyRoboflow } from './currencyRecognition.roboflow';
import { detectCurrencyGoogleVision } from './currencyRecognition.googleVision';
import { detectCurrencyGemini } from './currencyRecognition.gemini';
import { DetectionProvider, getDetectionProvider } from './objectDetection';

/**
 * Currency Recognition Service – Provider Selector
 *
 * Shares the same runtime provider as object detection (controlled by the in-app toggle).
 * Routes to Roboflow, Google Vision, or Gemini.
 * Maintains majority-voting buffer regardless of provider.
 * Throws CloudError on failures instead of returning mock data.
 */

// Majority voting buffer
let detectionBuffer: number[] = [];

export const detectCurrency = async (imageBase64: string): Promise<CurrencyDetection | null> => {
    const provider: DetectionProvider = getDetectionProvider();

    let raw: CurrencyDetection | null;

    switch (provider) {
        case 'google':
            raw = await detectCurrencyGoogleVision(imageBase64);
            break;
        case 'gemini':
            raw = await detectCurrencyGemini(imageBase64);
            break;
        default:
            raw = await detectCurrencyRoboflow(imageBase64);
    }

    if (!raw) return null;

    // Add to buffer for majority voting
    detectionBuffer.push(raw.denomination);
    if (detectionBuffer.length > config.DETECTION.FRAMES_FOR_CURRENCY) {
        detectionBuffer.shift();
    }

    const finalDenomination = getMajorityVote(detectionBuffer);

    return {
        denomination: finalDenomination,
        currency: raw.currency,
        confidence: raw.confidence,
    };
};

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

export const resetCurrencyBuffer = () => {
    detectionBuffer = [];
};
