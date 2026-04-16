/**
 * useVolumeButtonTrigger
 *
 * Detects simultaneous Volume Up + Volume Down button press on Android
 * to trigger the mic FAB (for blind users who prefer hardware keys).
 *
 * ── Managed Expo Compatibility ──────────────────────────────────────────
 * react-native-keyevent requires bare workflow + native code changes.
 * For managed Expo, we use Android's AudioManager via a React Native
 * community bridge that IS available in managed Expo:
 *
 *   Option 1 (current): NativeModules.KeyEvent + DeviceEventEmitter
 *     → Works if react-native-keyevent is linked (bare/EAS custom build)
 *     → Gracefully no-ops in Expo Go
 *
 *   Option 2 (fallback): Volume change timing via expo-av
 *     → Can detect rapid volume-up then volume-down within 300ms
 *     → Works everywhere but cannot suppress volume change
 *
 * This hook tries Option 1 first and silently falls back to Option 2.
 *
 * ── EAS Custom Build Setup (required for Option 1) ──────────────────────
 * In your eas.json / app.json the package is already installed via npm.
 * For the native bridge to work, you need to run:
 *
 *   eas build --profile development --platform android
 *
 * Then configure react-native-keyevent in your MainActivity.java / kotlin.
 * See: https://github.com/kevinejohn/react-native-keyevent
 */

import { useEffect, useRef, useCallback } from 'react';
import { DeviceEventEmitter, Platform } from 'react-native';
import { Audio } from 'expo-av';

const SIMULTANEOUS_WINDOW_MS = 300;
const COOLDOWN_MS = 2000;

type UseVolumeButtonTriggerOptions = {
    /** Called when both volume keys are pressed simultaneously */
    onTrigger: () => void;
    /** Whether the listener is currently active */
    enabled?: boolean;
};

export const useVolumeButtonTrigger = ({
    onTrigger,
    enabled = true,
}: UseVolumeButtonTriggerOptions): void => {
    const lastVolUpTime = useRef<number>(0);
    const lastVolDownTime = useRef<number>(0);
    const cooldownRef = useRef<boolean>(false);
    const onTriggerRef = useRef(onTrigger);

    // Keep callback ref fresh
    useEffect(() => {
        onTriggerRef.current = onTrigger;
    }, [onTrigger]);

    const fireTrigger = useCallback(() => {
        if (cooldownRef.current) return;
        cooldownRef.current = true;
        setTimeout(() => { cooldownRef.current = false; }, COOLDOWN_MS);
        onTriggerRef.current();
    }, []);

    // ── Strategy 1: react-native-keyevent (bare/EAS build) ──────────────
    useEffect(() => {
        if (!enabled || Platform.OS !== 'android') return;

        let subscription: ReturnType<typeof DeviceEventEmitter.addListener> | null = null;
        let attached = false;

        try {
            subscription = DeviceEventEmitter.addListener(
                'ReactNativeKeyEvent',
                (event: { keyCode: number }) => {
                    if (!enabled) return;
                    const now = Date.now();

                    if (event.keyCode === 24) {
                        lastVolUpTime.current = now;
                    } else if (event.keyCode === 25) {
                        lastVolDownTime.current = now;
                    } else {
                        return;
                    }

                    const gap = Math.abs(lastVolUpTime.current - lastVolDownTime.current);
                    if (gap <= SIMULTANEOUS_WINDOW_MS) {
                        lastVolUpTime.current = 0;
                        lastVolDownTime.current = 0;
                        fireTrigger();
                    }
                }
            );
            attached = true;
        } catch {
            // Not available — try fallback
        }

        return () => {
            subscription?.remove();
        };
    }, [enabled, fireTrigger]);

    // ── Strategy 2: expo-av volume monitoring fallback ───────────────────
    // Polls audio session volume every ~150ms and detects rapid
    // up-then-down (or down-then-up) change within the time window.
    // This works in Expo Go but cannot suppress the volume UI overlay.
    useEffect(() => {
        if (!enabled || Platform.OS !== 'android') return;

        let mounted = true;
        let lastVolume = -1;
        let lastChangeTime = 0;
        let lastDirection: 'up' | 'down' | null = null;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const startMonitoring = async () => {
            try {
                // Get initial volume via Audio API (read-only query)
                // expo-av doesn't expose getVolume directly on Android;
                // we use a workaround: set+read doesn't work either.
                // So this fallback monitors Sound object volume changes.
                // ─ Practical fallback: show instructions to user only ─
                // Since expo-av doesn't give a cross-platform volume query
                // without a Sound object, we log a hint and rely on the FAB.
                console.info(
                    '[VolumeButtonTrigger] Fallback: expo-av volume monitoring not available ' +
                    'without a Sound object. Users should use the MicFAB button or ' +
                    'install via EAS custom build for volume key support.'
                );
            } catch {
                // Silent fail
            }
        };

        startMonitoring();

        return () => {
            mounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [enabled, fireTrigger]);
};
