/**
 * MediaPipe Gesture → ISL Sign Mapper
 *
 * Maps the 8 built-in MediaPipe GestureRecognizer category names to
 * ISL-compatible result objects.  The shape matches `ISLDetection` so the
 * existing SignModeScreen UI can display results without any changes.
 *
 * MediaPipe built-ins:
 *   None | Closed_Fist | Open_Palm | Pointing_Up
 *   Thumb_Down | Thumb_Up | Victory | ILoveYou
 */

export interface ISLMappedGesture {
    sign: string;
    text: string;
    confidence: number;
    type: 'word' | 'letter';
    /** true when result came from MediaPipe (shown as ⚡ badge) */
    onDevice: boolean;
}

const GESTURE_MAP: Record<string, Omit<ISLMappedGesture, 'confidence' | 'onDevice'>> = {
    Thumb_Up: {
        sign: 'yes',
        text: 'Yes',
        type: 'word',
    },
    Closed_Fist: {
        sign: 'no',
        text: 'No',
        type: 'word',
    },
    Open_Palm: {
        sign: 'stop',
        text: 'Stop / Wait',
        type: 'word',
    },
    Victory: {
        sign: 'peace',
        text: 'Peace / Two',
        type: 'word',
    },
    ILoveYou: {
        sign: 'i love you',
        text: 'I Love You',
        type: 'word',
    },
    Pointing_Up: {
        sign: 'one',
        text: 'One / Listen',
        type: 'word',
    },
    Thumb_Down: {
        sign: 'bad',
        text: 'Bad / No Good',
        type: 'word',
    },
};

/**
 * Convert a raw MediaPipe gesture name + score into an ISLMappedGesture.
 * Returns `null` when the gesture is "None" or unknown.
 */
export const mapGestureToISL = (
    gesture: string,
    score: number,
): ISLMappedGesture | null => {
    if (!gesture || gesture === 'None') return null;

    const mapped = GESTURE_MAP[gesture];
    if (!mapped) return null;

    return {
        ...mapped,
        confidence: score,
        onDevice: true,
    };
};
