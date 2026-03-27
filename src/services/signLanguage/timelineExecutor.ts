import { SignTimeline } from '../../types';

export type PipelineState = 'idle' | 'listening' | 'processing' | 'playing' | 'error';

export interface TimelineExecutorHandlers {
    onSegmentStart?: (segmentId: string, signId: string) => void;
    onComplete?: () => void;
    onError?: (message: string) => void;
}

const wait = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

export class SignTimelineExecutor {
    private cancelled = false;

    cancel(): void {
        this.cancelled = true;
    }

    async execute(timeline: SignTimeline, handlers?: TimelineExecutorHandlers): Promise<void> {
        this.cancelled = false;

        try {
            for (const segment of timeline.segments) {
                if (this.cancelled) {
                    return;
                }

                handlers?.onSegmentStart?.(segment.segmentId, segment.signId);
                await wait(segment.durationMs);
            }

            if (!this.cancelled) {
                handlers?.onComplete?.();
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Timeline execution failed.';
            handlers?.onError?.(message);
        }
    }
}
