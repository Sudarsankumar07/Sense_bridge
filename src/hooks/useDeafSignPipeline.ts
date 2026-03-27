import { useEffect, useRef, useState } from 'react';
import config from '../constants/config';
import { listenForCommand, speakAndWait } from '../services/voiceEngine';
import { mapTranscriptToGloss } from '../services/signLanguage/glossMapper';
import { planSignTimeline, summarizeTimeline } from '../services/signLanguage/timelinePlanner';
import { PipelineState, SignTimelineExecutor } from '../services/signLanguage/timelineExecutor';
import { SignTimeline } from '../types';

interface UseDeafSignPipelineOptions {
    onBack: () => void;
}

interface DeafSignPipelineState {
    isListening: boolean;
    pipelineState: PipelineState;
    latestTranscript: string;
    latestGloss: string;
    latestTimelineSummary: string;
    latestTimeline?: SignTimeline;
    lastError: string | null;
}

export const useDeafSignPipeline = ({ onBack }: UseDeafSignPipelineOptions): DeafSignPipelineState => {
    const [isListening, setIsListening] = useState(false);
    const [pipelineState, setPipelineState] = useState<PipelineState>('idle');
    const [latestTranscript, setLatestTranscript] = useState('');
    const [latestGloss, setLatestGloss] = useState('');
    const [latestTimelineSummary, setLatestTimelineSummary] = useState('');
    const [latestTimeline, setLatestTimeline] = useState<SignTimeline | undefined>(undefined);
    const [lastError, setLastError] = useState<string | null>(null);

    const activeRef = useRef(true);
    const executorRef = useRef(new SignTimelineExecutor());

    useEffect(() => {
        activeRef.current = true;

        const runLoop = async () => {
            try {
                await speakAndWait('Deaf mode activated. Live captions are on. Say go back to return.');

                while (activeRef.current) {
                    setPipelineState('listening');
                    setIsListening(true);

                    const result = await listenForCommand(3500);
                    if (!activeRef.current) {
                        break;
                    }

                    setIsListening(false);

                    const text = (result.text || '').trim();
                    if (!text) {
                        continue;
                    }

                    const normalized = text.toLowerCase();
                    if (config.VOICE_COMMANDS.BACK.some((cmd) => normalized.includes(cmd))) {
                        onBack();
                        return;
                    }

                    setLatestTranscript(text);
                    setPipelineState('processing');

                    const gloss = mapTranscriptToGloss(text, 'ISL');
                    setLatestGloss(gloss.tokens.map((token) => token.token).join(' '));

                    const timeline = planSignTimeline(gloss);
                    setLatestTimeline(timeline);
                    setLatestTimelineSummary(summarizeTimeline(timeline));

                    setPipelineState('playing');
                    await executorRef.current.execute(timeline, {
                        onError: (message) => {
                            setLastError(message);
                            setPipelineState('error');
                        },
                    });

                    if (activeRef.current) {
                        setPipelineState('idle');
                    }
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Pipeline failed unexpectedly.';
                setLastError(message);
                setPipelineState('error');
                setIsListening(false);
            }
        };

        runLoop();

        return () => {
            activeRef.current = false;
            executorRef.current.cancel();
            setIsListening(false);
        };
    }, [onBack]);

    return {
        isListening,
        pipelineState,
        latestTranscript,
        latestGloss,
        latestTimelineSummary,
        latestTimeline,
        lastError,
    };
};
