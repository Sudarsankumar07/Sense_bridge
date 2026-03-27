import { SignGlossResult, SignTimeline, SignTimelineSegment } from '../../types';
import { resolveSignClip } from './animationLexicon';

const TRANSITION_GAP_MS = 120;

export const planSignTimeline = (gloss: SignGlossResult): SignTimeline => {
    let cursorMs = 0;

    const segments: SignTimelineSegment[] = gloss.tokens.map((token, index) => {
        const clip = resolveSignClip(token.token);

        const segment: SignTimelineSegment = {
            segmentId: `${token.token}-${index}`,
            signId: clip.signId,
            clipName: clip.clipName,
            startMs: cursorMs,
            durationMs: clip.defaultDurationMs,
            nonManualMarker: clip.nonManualMarker,
        };

        cursorMs += clip.defaultDurationMs + TRANSITION_GAP_MS;
        return segment;
    });

    return {
        originalText: gloss.originalText,
        language: gloss.language,
        totalDurationMs: segments.length > 0 ? cursorMs - TRANSITION_GAP_MS : 0,
        segments,
    };
};

export const summarizeTimeline = (timeline: SignTimeline): string => {
    if (timeline.segments.length === 0) {
        return 'No sign segments planned.';
    }

    const clipSummary = timeline.segments.map((segment) => segment.clipName).join(' -> ');
    return `${timeline.segments.length} segments in ${timeline.totalDurationMs}ms: ${clipSummary}`;
};
