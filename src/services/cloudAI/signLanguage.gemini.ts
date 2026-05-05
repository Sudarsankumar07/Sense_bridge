import { SignDetection } from '../../types';
import { CloudError } from '../../types';
import config from '../../constants/config';
import { GEMINI_API_KEY } from '@env';

/**
 * ISL Sign Language Detection via Gemini Vision
 *
 * Analyzes a camera frame and identifies Indian Sign Language (ISL) gestures.
 * ISL includes both fingerspelling (single-hand alphabet) and common word signs
 * that are distinct from ASL.
 *
 * Returns a SignDetection with the recognized ISL sign and its English translation.
 */

const API_URL = config.API.GEMINI_VISION;
const API_KEY = GEMINI_API_KEY || '';

const ISL_PROMPT = `You are an expert Indian Sign Language (ISL) interpreter.
Look at this image carefully. A person may be making an ISL hand sign.

ISL context: Indian Sign Language uses both hands for many letters and words. 
Common ISL fingerspelling letters and their typical handshapes are used.
Common ISL word signs include: hello, namaste, yes, no, help, water, food, 
thank you, sorry, please, good, bad, name, where, who, come, go, stop, mother, father, 
school, hospital, police, danger, pain, happy, sad, angry, love, eat, drink, sleep.

Respond ONLY with a JSON object — no markdown, no explanation, nothing else.
The JSON must have exactly these fields:
  "sign"       : string  (the ISL sign name, e.g. "hello", "namaste", "water", or the letter "A")
  "text"       : string  (the English meaning, e.g. "Hello / Namaste", "Water", "A")
  "confidence" : number  (0.0 to 1.0 — how confident you are)
  "type"       : string  ("word" or "letter")

If no clear ISL hand sign is visible, respond with:
{"sign":"none","text":"No sign detected","confidence":0.0,"type":"word"}

Examples:
{"sign":"namaste","text":"Hello / Namaste","confidence":0.91,"type":"word"}
{"sign":"water","text":"Water","confidence":0.85,"type":"word"}
{"sign":"A","text":"Letter A","confidence":0.88,"type":"letter"}`;

export interface ISLDetection extends SignDetection {
    type: 'word' | 'letter';
}

export const recognizeISLSign = async (imageBase64: string): Promise<ISLDetection> => {
    if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
        const err: CloudError = {
            source: 'object_detection',
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
                    { text: ISL_PROMPT },
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
        if (fetchErr?.name === 'AbortError') {
            throw { source: 'object_detection', provider: 'gemini', message: 'ISL detection timed out', timestamp: Date.now() } as CloudError;
        }
        throw fetchErr;
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
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    let parsed: any;
    try {
        parsed = JSON.parse(rawText);
    } catch {
        console.warn('[ISL] Could not parse Gemini response:', rawText.slice(0, 120));
        return { sign: 'none', text: 'No sign detected', confidence: 0, type: 'word' };
    }

    return {
        sign: parsed?.sign ?? 'none',
        text: parsed?.text ?? 'No sign detected',
        confidence: typeof parsed?.confidence === 'number' ? parsed.confidence : 0,
        type: parsed?.type === 'letter' ? 'letter' : 'word',
    };
};
