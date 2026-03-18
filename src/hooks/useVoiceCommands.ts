import { useEffect, useRef, useCallback } from 'react';
import { listenForCommand, speakAndWait } from '../services/voiceEngine';
import config from '../constants/config';

type CommandMap = Record<string, () => void>;

type UseVoiceCommandsOptions = {
    /** Message spoken when the screen mounts */
    intro: string;
    /** Map of command keys to handler functions */
    commands: CommandMap;
    /** Whether the voice loop is active (pause during camera etc.) */
    active?: boolean;
    /** Delay in ms between listen cycles (default 500) */
    loopDelay?: number;
};

/**
 * Reusable hook that speaks an intro, then continuously listens for voice
 * commands and dispatches them to the provided handlers.
 *
 * Command matching uses the keywords defined in config.VOICE_COMMANDS.
 * The `commands` keys should match config keys in lowercase:
 *   e.g. { obstacle: fn, currency: fn, back: fn }
 */
export const useVoiceCommands = ({
    intro,
    commands,
    active = true,
    loopDelay = 500,
}: UseVoiceCommandsOptions) => {
    const activeRef = useRef(true);
    const hasSpokenIntro = useRef(false);

    const matchCommand = useCallback(
        (text: string): (() => void) | null => {
            const normalized = text.toLowerCase();

            for (const [key, handler] of Object.entries(commands)) {
                const configKey = key.toUpperCase() as keyof typeof config.VOICE_COMMANDS;
                const keywords = config.VOICE_COMMANDS[configKey];

                if (keywords) {
                    if (keywords.some((kw: string) => normalized.includes(kw))) {
                        return handler;
                    }
                }
            }
            return null;
        },
        [commands]
    );

    useEffect(() => {
        activeRef.current = active;
    }, [active]);

    useEffect(() => {
        let mounted = true;
        activeRef.current = active;

        const loop = async () => {
            // Speak intro once
            if (!hasSpokenIntro.current) {
                hasSpokenIntro.current = true;
                await speakAndWait(intro);
            }

            while (mounted && activeRef.current) {
                const result = await listenForCommand(3000);

                if (!mounted || !activeRef.current) break;

                if (result.text) {
                    const handler = matchCommand(result.text);
                    if (handler) {
                        handler();
                        // Small pause after executing a command
                        await new Promise((r) => setTimeout(r, 1000));
                    }
                }

                // Small yield between listen cycles
                await new Promise((r) => setTimeout(r, loopDelay));
            }
        };

        // Small delay before starting so the screen renders first
        const timer = setTimeout(() => loop(), 300);

        return () => {
            mounted = false;
            activeRef.current = false;
            clearTimeout(timer);
        };
    }, [intro, matchCommand, active, loopDelay]);
};
