import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    TouchableOpacity,
    View,
    ActivityIndicator,
    Text,
    Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { listenForCommand } from '../services/voiceEngine';
import { hapticSelection, hapticWarning, hapticSuccess } from '../services/haptics';
import { safeNormalize, isNonEmpty } from '../utils/stringUtils';

export type MicFABState = 'idle' | 'listening' | 'processing' | 'success' | 'error';

type MicFABProps = {
    /** Called with the recognized transcript when a command is heard */
    onCommandReceived: (text: string) => void;
    /** Duration in ms to listen for speech (default: 5000) */
    listenTimeoutMs?: number;
    /** Prevent presses (e.g. during another async operation) */
    disabled?: boolean;
    /** Used externally to trigger mic programmatically (from volume buttons) */
    triggerRef?: React.MutableRefObject<(() => void) | null>;
};

/**
 * Floating Action Button with mic icon.
 * Pinned to bottom-right corner. Press (or use volume key combo) to:
 *   1. Record audio for listenTimeoutMs
 *   2. Send to Google Cloud STT
 *   3. Return transcript via onCommandReceived
 *
 * States:  idle → listening (pulse ring) → processing (spinner) → success/error (flash)
 */
export const MicFAB: React.FC<MicFABProps> = ({
    onCommandReceived,
    listenTimeoutMs = 5000,
    disabled = false,
    triggerRef,
}) => {
    const [micState, setMicState] = useState<MicFABState>('idle');

    // Animated values
    const pulseScale = useRef(new Animated.Value(1)).current;
    const pulseOpacity = useRef(new Animated.Value(0)).current;
    const ringScale = useRef(new Animated.Value(1)).current;
    const ringOpacity = useRef(new Animated.Value(0)).current;
    const buttonScale = useRef(new Animated.Value(1)).current;
    const flashOpacity = useRef(new Animated.Value(0)).current;
    const pulseAnimRef = useRef<Animated.CompositeAnimation | null>(null);

    // ── Start / stop pulse animation ──────────────────────────────────────
    useEffect(() => {
        if (micState === 'listening') {
            pulseAnimRef.current = Animated.loop(
                Animated.parallel([
                    Animated.sequence([
                        Animated.timing(pulseScale, { toValue: 1.45, duration: 900, useNativeDriver: true }),
                        Animated.timing(pulseScale, { toValue: 1, duration: 900, useNativeDriver: true }),
                    ]),
                    Animated.sequence([
                        Animated.timing(pulseOpacity, { toValue: 0.45, duration: 450, useNativeDriver: true }),
                        Animated.timing(pulseOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
                        Animated.delay(900),
                    ]),
                    Animated.sequence([
                        Animated.delay(450),
                        Animated.timing(ringScale, { toValue: 1.8, duration: 900, useNativeDriver: true }),
                        Animated.timing(ringScale, { toValue: 1, duration: 0, useNativeDriver: true }),
                    ]),
                    Animated.sequence([
                        Animated.delay(450),
                        Animated.timing(ringOpacity, { toValue: 0.25, duration: 300, useNativeDriver: true }),
                        Animated.timing(ringOpacity, { toValue: 0, duration: 600, useNativeDriver: true }),
                    ]),
                ])
            );
            pulseAnimRef.current.start();
        } else {
            pulseAnimRef.current?.stop();
            pulseScale.setValue(1);
            pulseOpacity.setValue(0);
            ringScale.setValue(1);
            ringOpacity.setValue(0);
        }
    }, [micState, pulseScale, pulseOpacity, ringScale, ringOpacity]);

    // ── Flash animation for success / error ───────────────────────────────
    const flashFeedback = useCallback((isSuccess: boolean) => {
        flashOpacity.setValue(1);
        Animated.timing(flashOpacity, {
            toValue: 0,
            duration: 700,
            useNativeDriver: true,
        }).start();

        if (isSuccess) {
            hapticSuccess();
        } else {
            hapticWarning();
        }
    }, [flashOpacity]);

    // ── Core record + recognize flow ──────────────────────────────────────
    const handleMicPress = useCallback(async () => {
        if (micState !== 'idle' || disabled) return;

        // Press-in scale
        Animated.spring(buttonScale, {
            toValue: 0.92,
            useNativeDriver: true,
            ...theme.animations.spring.stiff,
        }).start();

        hapticSelection();
        setMicState('listening');

        try {
            const result = await listenForCommand(listenTimeoutMs);

            setMicState('processing');

            // Small artificial delay so user sees "processing" state
            await new Promise(r => setTimeout(r, 300));

            // Null-safe via safeNormalize — result.text is null when STT hears nothing
            const transcript = safeNormalize(result.text);
            if (isNonEmpty(transcript)) {
                setMicState('success');
                flashFeedback(true);
                onCommandReceived(transcript);
            } else {
                setMicState('error');
                flashFeedback(false);
            }
        } catch {
            setMicState('error');
            flashFeedback(false);
        } finally {
            // Return to idle after feedback flash
            setTimeout(() => {
                setMicState('idle');
                Animated.spring(buttonScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    ...theme.animations.spring.gentle,
                }).start();
            }, 700);
        }
    }, [micState, disabled, buttonScale, listenTimeoutMs, flashFeedback, onCommandReceived]);

    /**
     * Programmatic trigger (from volume key combo).
     * Bypasses the `disabled` guard so blind users can always activate the mic
     * via hardware buttons, even when the FAB is visually disabled.
     */
    const handleVolumeTrigger = useCallback(async () => {
        if (micState !== 'idle') return; // still respect 'not already recording'

        Animated.spring(buttonScale, {
            toValue: 0.92,
            useNativeDriver: true,
            ...theme.animations.spring.stiff,
        }).start();

        hapticSelection();
        setMicState('listening');

        try {
            const result = await listenForCommand(listenTimeoutMs);

            setMicState('processing');
            await new Promise(r => setTimeout(r, 300));

            const transcript = safeNormalize(result.text);
            if (isNonEmpty(transcript)) {
                setMicState('success');
                flashFeedback(true);
                onCommandReceived(transcript);
            } else {
                setMicState('error');
                flashFeedback(false);
            }
        } catch {
            setMicState('error');
            flashFeedback(false);
        } finally {
            setTimeout(() => {
                setMicState('idle');
                Animated.spring(buttonScale, {
                    toValue: 1,
                    useNativeDriver: true,
                    ...theme.animations.spring.gentle,
                }).start();
            }, 700);
        }
    }, [micState, buttonScale, listenTimeoutMs, flashFeedback, onCommandReceived]);

    // ── Expose trigger to parent (for volume key combo) ───────────────────
    useEffect(() => {
        if (triggerRef) {
            // Volume key combo uses handleVolumeTrigger (ignores disabled)
            triggerRef.current = handleVolumeTrigger;
        }
    }, [triggerRef, handleVolumeTrigger]);

    // ── Derived colours ───────────────────────────────────────────────────
    const getButtonColor = (): string => {
        switch (micState) {
            case 'listening':  return theme.colors.primary;
            case 'processing': return theme.colors.primaryDeep;
            case 'success':    return theme.colors.accent;
            case 'error':      return theme.colors.danger;
            default:           return 'rgba(61,214,255,0.18)';
        }
    };

    const getFlashColor = (): string =>
        micState === 'error' ? theme.colors.danger : theme.colors.accent;

    const getIcon = () => {
        if (micState === 'processing') return null; // show spinner instead
        if (micState === 'success')
            return <Ionicons name="checkmark" size={28} color={theme.colors.background} />;
        if (micState === 'error')
            return <Ionicons name="close" size={28} color="#fff" />;
        if (micState === 'listening')
            return <MaterialCommunityIcons name="microphone" size={28} color={theme.colors.background} />;
        // idle
        return <MaterialCommunityIcons name="microphone-outline" size={28} color={theme.colors.primary} />;
    };

    const getStatusLabel = (): string => {
        switch (micState) {
            case 'listening':  return 'Listening...';
            case 'processing': return 'Processing...';
            case 'success':    return 'Got it!';
            case 'error':      return 'Try again';
            default:           return 'Tap mic or press Vol↑+Vol↓';
        }
    };

    return (
        <View style={styles.container} pointerEvents="box-none">
            {/* Flash overlay (success / error feedback) */}
            <Animated.View
                style={[
                    styles.flashOverlay,
                    {
                        backgroundColor: getFlashColor(),
                        opacity: flashOpacity,
                    },
                ]}
                pointerEvents="none"
            />

            {/* Status label strip */}
            {micState !== 'idle' && (
                <View style={styles.statusStrip}>
                    <Text style={styles.statusText}>{getStatusLabel()}</Text>
                </View>
            )}

            {/* Outer pulse ring */}
            <Animated.View
                style={[
                    styles.pulseRing,
                    { borderColor: theme.colors.primary },
                    {
                        transform: [{ scale: ringScale }],
                        opacity: ringOpacity,
                    },
                ]}
                pointerEvents="none"
            />

            {/* Inner pulse glow */}
            <Animated.View
                style={[
                    styles.pulseGlow,
                    { backgroundColor: theme.colors.primary },
                    {
                        transform: [{ scale: pulseScale }],
                        opacity: pulseOpacity,
                    },
                ]}
                pointerEvents="none"
            />

            {/* FAB button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity
                    style={[
                        styles.fab,
                        {
                            backgroundColor: getButtonColor(),
                            borderColor:
                                micState === 'idle'
                                    ? 'rgba(61,214,255,0.4)'
                                    : 'transparent',
                        },
                        disabled && styles.fabDisabled,
                        micState === 'listening' && styles.fabListening,
                    ]}
                    onPress={handleMicPress}
                    disabled={disabled || micState !== 'idle'}
                    accessibilityLabel="Tap to give a voice command"
                    accessibilityRole="button"
                    accessibilityHint="Activates voice recognition for one command"
                >
                    {micState === 'processing' ? (
                        <ActivityIndicator
                            size="small"
                            color={theme.colors.text}
                        />
                    ) : (
                        getIcon()
                    )}
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
};

const FAB_SIZE = 62;

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 28,
        right: 22,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999,
    },
    fab: {
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: FAB_SIZE / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        // Android shadow
        elevation: 10,
        // iOS shadow (kept for future iOS support)
        shadowColor: '#3dd6ff',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.45,
        shadowRadius: 12,
    },
    fabListening: {
        elevation: 16,
    },
    fabDisabled: {
        opacity: 0.45,
    },
    pulseGlow: {
        position: 'absolute',
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: FAB_SIZE / 2,
    },
    pulseRing: {
        position: 'absolute',
        width: FAB_SIZE,
        height: FAB_SIZE,
        borderRadius: FAB_SIZE / 2,
        borderWidth: 2,
    },
    statusStrip: {
        position: 'absolute',
        right: FAB_SIZE + 10,
        backgroundColor: 'rgba(18,25,35,0.93)',
        borderRadius: theme.radius.pill,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(61,214,255,0.3)',
        minWidth: 130,
        alignItems: 'center',
        // Android shadow
        elevation: 8,
    },
    statusText: {
        ...theme.typography.caption,
        color: theme.colors.primary,
    },
    flashOverlay: {
        position: 'absolute',
        width: FAB_SIZE * 2.5,
        height: FAB_SIZE * 2.5,
        borderRadius: FAB_SIZE * 1.25,
        zIndex: -1,
    },
});
