import { SpeechResult } from '../../types';

const DEMO_PHRASES = [
    'hello there',
    'thank you',
    'please help me',
    'good morning',
    'yes',
    'no',
];

export const initializeSpeechRecognition = async () => {
    return true;
};

export const startListening = async (): Promise<SpeechResult> => {
    const random = DEMO_PHRASES[Math.floor(Math.random() * DEMO_PHRASES.length)];
    return {
        text: random,
        isFinal: true,
        confidence: 0.82 + Math.random() * 0.12,
    };
};

export const stopListening = async () => {
    return true;
};

export const recognizeCommand = async (): Promise<string | null> => {
    const random = DEMO_PHRASES[Math.floor(Math.random() * DEMO_PHRASES.length)];
    return random;
};
