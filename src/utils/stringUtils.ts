/**
 * stringUtils.ts
 *
 * Shared null-safe string helpers.
 *
 * CONTEXT  — Why this file exists:
 * Google Cloud STT returns `result.text = null` whenever no speech is
 * detected (silence, noise, network error, quota exceeded).
 * Multiple screens and hooks were calling `.trim()` or `.toLowerCase()`
 * directly on that value, causing:
 *   TypeError: Cannot read property 'trim' of undefined
 *
 * These helpers centralise the guard so the bug cannot recur.
 */

/**
 * Coerce any value to a string.
 * null / undefined → '' (empty string)
 */
export const safeString = (value: unknown): string => {
    if (value == null) return '';
    return String(value);
};

/**
 * Lowercase + trim, safe against null / undefined input.
 * Use this everywhere you would write:  text.toLowerCase().trim()
 * and text might not be a real string.
 */
export const safeNormalize = (value: unknown): string => {
    return safeString(value).toLowerCase().trim();
};

/**
 * Returns true when the value is a non-empty string after trimming.
 */
export const isNonEmpty = (value: unknown): boolean => {
    return safeNormalize(value).length > 0;
};
