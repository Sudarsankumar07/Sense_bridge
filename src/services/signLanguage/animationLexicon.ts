import { SignAnimationClip } from '../../types';

const BASE_DURATION = 700;

const SIGN_LEXICON: Record<string, SignAnimationClip> = {
    HELLO: {
        signId: 'HELLO',
        clipName: 'wave_hello',
        defaultDurationMs: 900,
        handshape: 'open_palm',
        nonManualMarker: 'neutral',
    },
    THANK_YOU: {
        signId: 'THANK-YOU',
        clipName: 'thank_you',
        defaultDurationMs: 900,
        handshape: 'flat_hand',
        nonManualMarker: 'smile',
    },
    THANK_YOU_ALT: {
        signId: 'THANKYOU',
        clipName: 'thank_you',
        defaultDurationMs: 900,
        handshape: 'flat_hand',
        nonManualMarker: 'smile',
    },
    YES: {
        signId: 'YES',
        clipName: 'yes',
        defaultDurationMs: 650,
        handshape: 'fist',
    },
    NO: {
        signId: 'NO',
        clipName: 'no',
        defaultDurationMs: 650,
        handshape: 'pinch',
    },
    HELP: {
        signId: 'HELP',
        clipName: 'help',
        defaultDurationMs: 900,
        handshape: 'thumb_up_open_palm',
    },
    PLEASE: {
        signId: 'PLEASE',
        clipName: 'please',
        defaultDurationMs: 800,
        handshape: 'flat_hand_circle',
        nonManualMarker: 'soft',
    },
    STOP: {
        signId: 'STOP',
        clipName: 'stop',
        defaultDurationMs: 750,
        handshape: 'open_palm',
    },
};

const FALLBACK_CLIP = (token: string): SignAnimationClip => ({
    signId: token,
    clipName: 'fingerspell',
    defaultDurationMs: BASE_DURATION,
    handshape: 'alphabetic',
});

export const resolveSignClip = (token: string): SignAnimationClip => {
    const key = token.replace(/-/g, '_');

    if (SIGN_LEXICON[key]) {
        return SIGN_LEXICON[key];
    }

    if (SIGN_LEXICON[token]) {
        return SIGN_LEXICON[token];
    }

    return FALLBACK_CLIP(token);
};
