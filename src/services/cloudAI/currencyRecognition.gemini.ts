import { CurrencyDetection, CloudError } from '../../types';
import config from '../../constants/config';
import { GEMINI_API_KEY } from '@env';

/**
 * Gemini Vision Currency Detection Provider
 *
 * Uses Gemini 1.5 Flash to identify Indian currency denomination from an image.
 * Returns the same CurrencyDetection | null shape as the Google Vision provider.
 */

const API_URL = config.API.GEMINI_VISION;
const API_KEY = GEMINI_API_KEY || '';

const KNOWN_DENOMINATIONS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 2000];

const PROMPT = `You are a currency detection assistant for Indian Rupee (INR) banknotes and coins.
Look at this image carefully.
If you see an Indian currency note or coin, respond ONLY with a JSON object — no markdown, no explanation.
The JSON must have exactly these fields:
  "denomination" : number  (one of: 1, 2, 5, 10, 20, 50, 100, 200, 500, 2000)
  "confidence"   : number  (0.0 to 1.0)
If there is no Indian currency visible, respond with an empty object: {}
Example: {"denomination":500,"confidence":0.95}`;

export const detectCurrencyGemini = async (imageBase64: string): Promise<CurrencyDetection | null> => {
    if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
        const err: CloudError = {
            source: 'currency_detection',
            provider: 'gemini',
            message: 'GEMINI_API_KEY is missing. Add it to your .env file.',
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
            temperature: 0.1,
            maxOutputTokens: 128,
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
            source: 'currency_detection',
            provider: 'gemini',
            message: fetchErr?.name === 'AbortError' ? 'Gemini request timed out (15s)' : fetchErr?.message ?? 'Network error',
            timestamp: Date.now(),
        };
        throw err;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
        const err: CloudError = {
            source: 'currency_detection',
            provider: 'gemini',
            httpStatus: response.status,
            message: `Gemini returned HTTP ${response.status}`,
            timestamp: Date.now(),
        };
        throw err;
    }

    const data = await response.json();
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let parsed: any;
    try {
        parsed = JSON.parse(rawText);
    } catch {
        console.warn('[Gemini] Currency: could not parse response:', rawText.slice(0, 100));
        return null;
    }

    if (!parsed || Object.keys(parsed).length === 0 || typeof parsed.denomination !== 'number') return null;
    if (!KNOWN_DENOMINATIONS.includes(parsed.denomination)) return null;

    return {
        denomination: parsed.denomination,
        currency: 'INR',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
    };
};
