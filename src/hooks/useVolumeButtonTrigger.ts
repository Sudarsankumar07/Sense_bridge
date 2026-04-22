/**
 * useVolumeButtonTrigger
 *
 * Detects simultaneous Volume Up + Volume Down press on Android
 * using react-native-volume-manager (has Expo config plugin, works
 * in EAS development build / custom dev client).
 *
 * ── Detection strategy ───────────────────────────────────────────────────
 * The VolumeManager fires a listener every time the system volume changes.
 * We track:
 *   - Direction of each change (+delta = vol up, -delta = vol down)
 *   - Time of each change
 *
 * "Simultaneous" combo = two changes in opposite directions within
 * COMBO_WINDOW_MS (300ms) of each other. This reliably detects pressing
 * both volume keys at nearly the same time.
 *
 * ── Requires EAS dev client (not Expo Go) ────────────────────────────────
 * react-native-volume-manager uses native Android AudioManager.
 * It works fine if you built the APK with `eas build --profile development`.
 * It silently no-ops in Expo Go (the import fails gracefully).
 */

import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { forceResetRecordingState } from '../services/voiceEngine';

// Dynamic import so the module is optional (Expo Go won't crash)
let VolumeManager: any = null;
try {
    VolumeManager = require('react-native-volume-manager').VolumeManager;
} catch {
    // Not available in Expo Go — no-op
}

const COMBO_WINDOW_MS = 500;   // ms between Up and Down to count as "simultaneous" (increased for physical key reliability)
const COOLDOWN_MS    = 2500;   // ms before next trigger can fire
const MIN_DELTA      = 0.03;   // minimum volume change to count (slightly relaxed for all device types)

type UseVolumeButtonTriggerOptions = {
    /** Called when Volume Up + Volume Down are pressed simultaneously */
    onTrigger: () => void;
    /** Whether the listener is active (pause when screen is unfocused) */
    enabled?: boolean;
};

export const useVolumeButtonTrigger = ({
    onTrigger,
    enabled = true,
}: UseVolumeButtonTriggerOptions): void => {
    const onTriggerRef    = useRef(onTrigger);
    const cooldownRef     = useRef(false);
    const lastChangeTime  = useRef(0);
    const lastDirection   = useRef<'up' | 'down' | null>(null);
    const lastVolume      = useRef<number>(-1);

    // Always keep the callback ref current
    useEffect(() => {
        onTriggerRef.current = onTrigger;
    }, [onTrigger]);

    const fireTrigger = useCallback(() => {
        if (cooldownRef.current) {
            console.log('[VolumeButtonTrigger] ⏰ Cooldown active — ignoring combo');
            return;
        }
        cooldownRef.current = true;
        setTimeout(() => { cooldownRef.current = false; }, COOLDOWN_MS);

        // Reset tracking so we don't double-fire
        lastDirection.current = null;
        lastVolume.current = -1;

        // Clear any stale recording mutex so STT is guaranteed to start
        forceResetRecordingState();

        console.log('[VolumeButtonTrigger] 🎙️ Combo detected — triggering mic');
        onTriggerRef.current();
    }, []);

    useEffect(() => {
        // Only works on Android with the native module
        if (!enabled || Platform.OS !== 'android' || !VolumeManager) {
            if (!VolumeManager) {
                console.info(
                    '[VolumeButtonTrigger] react-native-volume-manager not available. ' +
                    'Running in Expo Go? Volume combo requires the EAS dev client APK.'
                );
            }
            return;
        }

        // Disable the native volume UI toast so the volume change is "silent"
        // (the user pressed both buttons → we don't want the volume bar popping up)
        try {
            VolumeManager.showNativeVolumeUI({ enabled: false });
        } catch {
            // Some versions don't support this — ignore
        }

        const subscription = VolumeManager.addVolumeListener(
            (result: { volume: number }) => {
                if (!enabled) return;

                const newVolume = result.volume;
                const prevVolume = lastVolume.current;

                // Skip first reading (no previous to compare)
                if (prevVolume === -1) {
                    lastVolume.current = newVolume;
                    return;
                }

                const delta = newVolume - prevVolume;
                lastVolume.current = newVolume;

                // Ignore tiny fluctuations
                if (Math.abs(delta) < MIN_DELTA) return;

                const now = Date.now();
                const direction: 'up' | 'down' = delta > 0 ? 'up' : 'down';
                const timeSinceLast = now - lastChangeTime.current;

                if (
                    lastDirection.current !== null &&
                    lastDirection.current !== direction &&
                    timeSinceLast <= COMBO_WINDOW_MS
                ) {
                    // Opposite direction within the window → COMBO!
                    fireTrigger();
                } else {
                    // Record this change as the "first" of a potential combo
                    lastDirection.current = direction;
                    lastChangeTime.current = now;
                }
            }
        );

        return () => {
            // Re-enable the native volume UI on unmount
            try {
                VolumeManager.showNativeVolumeUI({ enabled: true });
            } catch { /* ignore */ }
            subscription?.remove?.();
        };
    }, [enabled, fireTrigger]);
};
