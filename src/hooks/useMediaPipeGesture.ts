import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaPipeGestureWebViewRef, MPGestureResult } from '../components/MediaPipeGestureWebView';

// Maximum frames to send per second (throttle to avoid flooding the WASM worker)
const MAX_FPS = 5;
const FRAME_INTERVAL_MS = 1000 / MAX_FPS;

/**
 * RC-4 FIX: If the WebView hasn't posted 'ready' within this window, the CDN
 * bundle or WASM model silently failed to load. We surface an error instead of
 * staying in a silent broken state forever.
 */
const READY_TIMEOUT_MS = 20_000;

export interface UseMediaPipeGestureReturn {
    /** Attach this to the <MediaPipeGestureWebView ref={…} /> */
    webViewRef: React.RefObject<MediaPipeGestureWebViewRef | null>;
    /** Whether the WASM recognizer has finished initialising */
    isReady: boolean;
    /**
     * RC-3 / RC-4 FIX: Non-null when MediaPipe failed to init (CDN timeout,
     * WASM error, network error). Show this in the UI so the user knows.
     */
    initError: string | null;
    /** Last result received from MediaPipe (React state — use for reactive UI) */
    lastResult: MPGestureResult | null;
    /**
     * RC-2 FIX: Ref mirror of lastResult for synchronous reads inside async
     * loops. Always up-to-date — not subject to React closure staleness.
     */
    lastResultRef: React.RefObject<MPGestureResult | null>;
    /** Call this with a JPEG base64 string (no data-uri prefix) to run recognition */
    sendFrame: (base64: string) => void;
    /** Callbacks to wire into <MediaPipeGestureWebView> */
    onReady: () => void;
    onResult: (result: MPGestureResult) => void;
    onError: (message: string) => void;
}

/**
 * useMediaPipeGesture
 *
 * Manages communication with the hidden MediaPipeGestureWebView.
 *
 * Fixes applied (see RCA doc):
 *   RC-2: lastResultRef (useRef) mirrors lastResult for stale-closure-safe reads
 *   RC-3: CDN / WASM errors are surfaced via initError instead of swallowed
 *   RC-4: 20s ready-timeout so silent init failures become visible to the user
 */
export const useMediaPipeGesture = (): UseMediaPipeGestureReturn => {
    const webViewRef = useRef<MediaPipeGestureWebViewRef | null>(null);

    const [isReady, setIsReady] = useState(false);
    const [initError, setInitError] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<MPGestureResult | null>(null);

    // RC-2 FIX: ref mirror so async loops always read the latest value
    const lastResultRef = useRef<MPGestureResult | null>(null);

    // Ref to track isReady inside onError without closure staleness
    const isReadyRef = useRef(false);

    // Throttle
    const lastSentAt = useRef<number>(0);

    // RC-4 FIX: timeout handle so we can clear it on successful init
    const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // RC-4 FIX: start the timeout on mount; clear it in onReady
    useEffect(() => {
        readyTimeoutRef.current = setTimeout(() => {
            if (!isReadyRef.current) {
                const msg =
                    'MediaPipe failed to initialize within 20 s. ' +
                    'Check your internet connection — the WASM bundle (~25 MB) must download on first use.';
                console.warn('[MediaPipe] Ready timeout:', msg);
                setInitError(msg);
            }
        }, READY_TIMEOUT_MS);

        return () => {
            if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sendFrame = useCallback((base64: string) => {
        if (!isReady) return;
        const now = Date.now();
        if (now - lastSentAt.current < FRAME_INTERVAL_MS) return; // throttle
        lastSentAt.current = now;
        webViewRef.current?.sendFrame(base64);
    }, [isReady]);

    const onReady = useCallback(() => {
        console.log('[MediaPipe] Recognizer ready ✅');
        // RC-4 FIX: cancel the timeout — init succeeded
        if (readyTimeoutRef.current) clearTimeout(readyTimeoutRef.current);
        isReadyRef.current = true;
        setInitError(null);
        setIsReady(true);
    }, []);

    const onResult = useCallback((result: MPGestureResult) => {
        // RC-2 FIX: update both ref (sync reads in loops) AND state (reactive UI)
        lastResultRef.current = result;
        setLastResult(result);
    }, []);

    const onError = useCallback((message: string) => {
        console.warn('[MediaPipe] Error:', message);
        // RC-3 FIX: surface errors that arrive before isReady so the UI
        // shows a clear failure message instead of a frozen scanning animation
        if (!isReadyRef.current) {
            setInitError(message);
        }
    }, []);

    return {
        webViewRef,
        isReady,
        initError,
        lastResult,
        lastResultRef,
        sendFrame,
        onReady,
        onResult,
        onError,
    };
};
