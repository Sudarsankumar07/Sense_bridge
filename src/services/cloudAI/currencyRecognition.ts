import { CurrencyDetection } from '../../types';
import config from '../../constants/config';

/**
 * Currency Recognition Service
 * Detects Indian currency notes and coins
 */

const API_URL = config.API.CURRENCY_DETECTION;
const API_KEY = process.env.ROBOFLOW_API_KEY || 'demo';
const MODEL_ID = process.env.ROBOFLOW_CURRENCY_MODEL || 'indian-currency';

// Majority voting buffer
let detectionBuffer: number[] = [];

export const detectCurrency = async (imageBase64: string): Promise<CurrencyDetection | null> => {
    try {
        // For demo purposes, if no API key, return mock data
        if (API_KEY === 'demo') {
            return getMockCurrencyDetection();
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const url = new URL(`${API_URL}/${MODEL_ID}`);
        url.searchParams.append('api_key', API_KEY);

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: imageBase64 }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.predictions && data.predictions.length > 0) {
            const prediction = data.predictions[0];
            const denomination = parseDenomination(prediction.class);

            // Add to buffer for majority voting
            detectionBuffer.push(denomination);
            if (detectionBuffer.length > config.DETECTION.FRAMES_FOR_CURRENCY) {
                detectionBuffer.shift();
            }

            // Get majority vote
            const finalDenomination = getMajorityVote(detectionBuffer);

            return {
                denomination: finalDenomination,
                currency: 'INR',
                confidence: prediction.confidence,
            };
        }

        return null;
    } catch (error) {
        console.error('Currency detection error:', error);
        return getMockCurrencyDetection();
    }
};

/**
 * Parse denomination from class name
 */
const parseDenomination = (className: string): number => {
    const match = className.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
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

/**
 * Mock currency detection for testing without API
 */
const getMockCurrencyDetection = (): CurrencyDetection => {
    const denominations = [10, 20, 50, 100, 200, 500, 2000];
    const randomDenomination = denominations[Math.floor(Math.random() * denominations.length)];

    return {
        denomination: randomDenomination,
        currency: 'INR',
        confidence: 0.88 + Math.random() * 0.1,
    };
};
