import { SignDetection } from '../../types';

const SIGNS = [
    { sign: 'hello', text: 'Hello' },
    { sign: 'thank_you', text: 'Thank you' },
    { sign: 'help', text: 'I need help' },
    { sign: 'yes', text: 'Yes' },
    { sign: 'no', text: 'No' },
];

export const recognizeSign = async (): Promise<SignDetection> => {
    const random = SIGNS[Math.floor(Math.random() * SIGNS.length)];

    return {
        sign: random.sign,
        text: random.text,
        confidence: 0.86 + Math.random() * 0.1,
    };
};
