import { useCallback, useEffect, useRef } from 'react';
import { listenForCommand, speakAndWait } from '../services/voiceEngine';
import config from '../constants/config';
import { safeNormalize, isNonEmpty } from '../utils/stringUtils';

type CommandMap = Record<string, () => void>;

type UseVoiceCommandsOptions = {
    /** Message spoken once when the screen mounts */
    intro: string;
    /** Map of command keys to handler functions */
    commands: CommandMap;
    /** Timeout in ms for each listen session (default: 5000) */
    listenTimeoutMs?: number;
};

type UseVoiceCommandsReturn = {
    /**
     * Call this to start ONE voice recognition session.
     * Designed to be triggered by MicFAB press or volume button combo.
     * Returns true if a command was matched.
     */
    triggerListen: () => Promise<boolean>;
};

/**
 * Reusable hook for on-demand voice command dispatch.
 *
 * IMPORTANT: This hook NO LONGER runs a continuous listen loop.
 * Voice recognition only starts when `triggerListen()` is called,
 * which should be connected to the MicFAB button or volume key combo.
 * This eliminates constant Google Cloud STT API calls.
 *
 * It still:
 *  - Speaks the intro message once on mount (TTS only, no STT cost)
 *  - Matches spoken text to config.VOICE_COMMANDS keywords
 */
export const useVoiceCommands = ({
    intro,
    commands,
    listenTimeoutMs = 5000,
}: UseVoiceCommandsOptions): UseVoiceCommandsReturn => {
    const hasSpokenIntro = useRef(false);
    const commandsRef = useRef(commands);

    // Keep commands ref up to date if parent re-renders
    useEffect(() => {
        commandsRef.current = commands;
    }, [commands]);

    // Speak intro once on mount (TTS only — zero STT cost)
    useEffect(() => {
        if (hasSpokenIntro.current) return;
        hasSpokenIntro.current = true;

        const timer = setTimeout(() => {
            speakAndWait(intro).catch(() => { });
        }, 400);

        return () => clearTimeout(timer);
    }, [intro]);

    // Match recognized text against command keywords
    const matchCommand = useCallback((text: string | null | undefined): (() => void) | null => {
        const normalized = safeNormalize(text);
        if (!normalized) return null;

        for (const [key, handler] of Object.entries(commandsRef.current)) {
            const configKey = key.toUpperCase() as keyof typeof config.VOICE_COMMANDS;
            const keywords = config.VOICE_COMMANDS[configKey];

            if (keywords) {
                if (keywords.some((kw: string) => normalized.includes(kw))) {
                    return handler;
                }
            }
        }
        return null;
    }, []);

    /**
     * Fire a single listen + dispatch cycle.
     * Connect this to MicFAB.onCommandReceived or volume button trigger.
     */
    const triggerListen = useCallback(async (): Promise<boolean> => {
        const result = await listenForCommand(listenTimeoutMs);

        const transcript = safeNormalize(result.text);
        if (isNonEmpty(transcript)) {
            const handler = matchCommand(transcript);
            if (handler) {
                handler();
                return true;
            }
        }
        return false;
    }, [matchCommand, listenTimeoutMs]);

    return { triggerListen };
};
