import { SignDetection } from '../../types';
import { recognizeISLSign, ISLDetection } from './signLanguage.gemini';

/**
 * ISL Sign Language Recognition Service
 *
 * Replaced the random mock with real Gemini Vision ISL detection.
 * Accepts a base64 camera frame and returns the recognized ISL sign.
 *
 * The SignModeScreen calls this every ~2.5 seconds with a captured frame.
 */

export type { ISLDetection };

export const recognizeSign = async (imageBase64: string): Promise<ISLDetection> => {
    return recognizeISLSign(imageBase64);
};
