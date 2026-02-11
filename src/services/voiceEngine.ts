import * as Speech from 'expo-speech';
import Constants from 'expo-constants';
import config from '../constants/config';

export type VoiceCommandResult = {
    text: string | null;
    confidence: number;
    isFinal: boolean;
};

const isExpoGo = Constants.appOwnership === 'expo';

let currentRate = config.VOICE.DEFAULT_SPEED;
let currentLanguage = config.VOICE.LANGUAGE;

export const setVoiceSettings = (rate: number, language: string) => {
    currentRate = Math.max(config.VOICE.MIN_SPEED, Math.min(config.VOICE.MAX_SPEED, rate));
    currentLanguage = language;
};

export const speak = (text: string, interrupt = true) => {
    if (interrupt) {
        Speech.stop();
    }

    Speech.speak(text, {
        rate: currentRate,
        language: currentLanguage,
        pitch: 1.0,
    });
};

export const stopSpeaking = () => {
    Speech.stop();
};

export const listenForCommand = async (timeoutMs = 3500): Promise<VoiceCommandResult> => {
    // Expo Go cannot do offline STT. Return null to force manual selection.
    if (isExpoGo) {
        return new Promise(resolve => {
            setTimeout(() => resolve({ text: null, confidence: 0, isFinal: true }), timeoutMs);
        });
    }

    // Placeholder for native offline STT (Vosk) integration.
    return new Promise(resolve => {
        setTimeout(() => resolve({ text: null, confidence: 0, isFinal: true }), timeoutMs);
    });
};
