import { SignGlossResult, SignGlossToken } from '../../types';
import { safeNormalize } from '../../utils/stringUtils';

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

const normalizeWord = (word: string | undefined | null): string => {
    // safeNormalize handles null/undefined; protects against split() producing empty strings
    const trimmed = safeNormalize(word);
    if (!trimmed) return '';
    if (NORMALIZATION_MAP[trimmed]) return NORMALIZATION_MAP[trimmed];
    return trimmed.toUpperCase();
};

const buildToken = (rawWord: string | undefined | null): SignGlossToken | null => {
    // Null-safe: .map() can produce undefined elements in edge cases
    const normalized = safeNormalize(rawWord);
    if (!normalized || STOP_WORDS.has(normalized)) return null;
    return {
        token: normalizeWord(normalized),
        confidence: 0.82,
    };
};

export const mapTranscriptToGloss = (
    text: string | undefined | null,
    language: 'ISL' | 'ASL' = 'ISL'
): SignGlossResult => {
    if (!text) {
        return { originalText: '', language, tokens: [] };
    }
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
