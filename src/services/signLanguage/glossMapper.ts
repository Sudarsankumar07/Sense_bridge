import { SignGlossResult, SignGlossToken } from '../../types';

const STOP_WORDS = new Set([
    'a',
    'an',
    'the',
    'is',
    'am',
    'are',
    'to',
    'of',
    'for',
    'and',
    'that',
    'this',
    'it',
]);

const NORMALIZATION_MAP: Record<string, string> = {
    hello: 'HELLO',
    hi: 'HELLO',
    thanks: 'THANK-YOU',
    thank: 'THANK-YOU',
    yes: 'YES',
    no: 'NO',
    help: 'HELP',
    stop: 'STOP',
    please: 'PLEASE',
    water: 'WATER',
    food: 'FOOD',
    home: 'HOME',
    school: 'SCHOOL',
};

const normalizeWord = (word: string): string => {
    const trimmed = word.trim().toLowerCase();
    if (!trimmed) {
        return '';
    }

    if (NORMALIZATION_MAP[trimmed]) {
        return NORMALIZATION_MAP[trimmed];
    }

    return trimmed.toUpperCase();
};

const buildToken = (rawWord: string): SignGlossToken | null => {
    const normalized = rawWord.toLowerCase().trim();
    if (!normalized || STOP_WORDS.has(normalized)) {
        return null;
    }

    return {
        token: normalizeWord(normalized),
        confidence: 0.82,
    };
};

export const mapTranscriptToGloss = (
    text: string,
    language: 'ISL' | 'ASL' = 'ISL'
): SignGlossResult => {
    const cleaned = text
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const tokens = cleaned
        .split(' ')
        .map(buildToken)
        .filter((token): token is SignGlossToken => token !== null);

    return {
        originalText: text,
        language,
        tokens,
    };
};
