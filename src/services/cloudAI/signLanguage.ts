import { mapGestureToISL, ISLMappedGesture } from '../mediapipe/gestureToISL';

/**
 * ISL Sign Language Recognition Service
 *
 * Uses MediaPipe GestureRecognizer (on-device, zero cloud cost) exclusively.
 * Gemini is NOT used for sign language translation.
 *
 * The SignModeScreen calls mp.sendFrame() / mp.lastResult directly for the
 * MediaPipe fast path. This module provides a thin wrapper that keeps the
 * ISLDetection shape compatible with the rest of the UI.
 */

export interface ISLDetection {
    sign: string;
    text: string;
    confidence: number;
    type: 'word' | 'letter';
    /** Always true — results come from on-device MediaPipe, never cloud */
    onDevice: true;
}

/**
 * Convert a raw MediaPipe gesture result into an ISLDetection.
 * Returns null when the gesture is "None" or below the confidence threshold.
 */
export const recognizeSign = (gesture: string, score: number): ISLDetection | null => {
    const mapped: ISLMappedGesture | null = mapGestureToISL(gesture, score);
    if (!mapped) return null;
    return {
        sign: mapped.sign,
        text: mapped.text,
        confidence: mapped.confidence,
        type: mapped.type,
        onDevice: true,
    };
};
