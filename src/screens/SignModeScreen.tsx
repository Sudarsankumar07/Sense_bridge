import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView } from 'expo-camera';
import { theme } from '../theme';
import { CameraViewComponent } from '../components';
import { speak } from '../services/voiceEngine';
import { hapticSelection, hapticSuccess, hapticWarning } from '../services/haptics';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { captureFrame } from '../utils/camera';
import { MediaPipeGestureWebView } from '../components/MediaPipeGestureWebView';
import { useMediaPipeGesture } from '../hooks/useMediaPipeGesture';
import { useMediaPipeAssets } from '../hooks/useMediaPipeAssets';
import { mapGestureToISL } from '../services/mediapipe';
import type { ISLMappedGesture } from '../services/mediapipe';

// Minimum confidence to show and speak a result
const CONFIDENCE_THRESHOLD = 0.55;
// RC-6 FIX: Reduced from 4500ms to 1500ms for responsive gesture capture
const CAPTURE_INTERVAL_MS = 1500;

export const SignModeScreen: React.FC = () => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const cameraRef = useRef<CameraView>(null);

    const [currentSign, setCurrentSign] = useState<string>('Waiting for sign…');
    const [currentText, setCurrentText] = useState<string>('');
    const [signType, setSignType] = useState<'word' | 'letter'>('word');
    const [confidence, setConfidence] = useState<number>(0);
    const [isScanning, setIsScanning] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [scanCount, setScanCount] = useState<number>(0);
    // true when the last result came from on-device MediaPipe
    const [onDevice, setOnDevice] = useState<boolean>(false);

    // RC-3 FIX: Download WASM + model to device cache so CDN is never needed again
    const assets = useMediaPipeAssets();
    const mp = useMediaPipeGesture();

    // RC-2 FIX: use a ref for lastSpoken so the result-processing useEffect
    // always reads the latest value without stale-closure issues
    const lastSpokenRef = useRef<string>('');

    // Pulse animation for the scanning indicator
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

    const startPulse = () => {
        pulseLoop.current = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
            ])
        );
        pulseLoop.current.start();
    };

    const stopPulse = () => {
        pulseLoop.current?.stop();
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 200, useNativeDriver: true }).start();
    };

    useVoiceCommands({
        intro: 'Sign Mode. ISL sign detection is active. Show a hand sign to the camera. Say go back to return.',
        commands: {
            back: () => { hapticSelection(); navigation.goBack(); },
        },
    });

    // ── RC-1 & RC-2 FIX: Frame-send loop (send only — NO result read here) ──
    //
    // The previous architecture read mp.lastResult immediately after sendFrame(),
    // which is a race condition: the WebView round-trip takes 50-300ms so the
    // result was always null or one frame behind.
    //
    // Fix: this loop only captures + sends frames. Result processing is handled
    // in a separate useEffect that reacts to mp.lastResult changes (below).
    useEffect(() => {
        let active = true;

        const loop = async () => {
            while (active) {
                // Pause when screen not focused
                if (!isFocused) {
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }

                // Wait for MediaPipe WASM to finish loading
                if (!mp.isReady) {
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }

                setIsScanning(true);
                startPulse();

                try {
                    const frame = await captureFrame(cameraRef.current);

                    if (frame?.base64 && active) {
                        setScanCount(c => c + 1);
                        // Send frame — result arrives asynchronously via onResult → mp.lastResult
                        mp.sendFrame(frame.base64);
                    }
                } catch (err: any) {
                    if (!active) break;
                    const msg = err?.message ?? 'Camera capture error';
                    console.error('[SignMode] Camera error:', msg);
                    setErrorMsg(msg);
                    hapticWarning();
                }

                setIsScanning(false);
                stopPulse();
                // RC-6 FIX: 1500ms instead of 4500ms for responsive detection
                await new Promise(r => setTimeout(r, CAPTURE_INTERVAL_MS));
            }
        };

        loop();
        return () => { active = false; };
    }, [isFocused, mp.isReady]);

    // ── RC-1 & RC-2 FIX: Event-driven result processing ───────────────────
    //
    // This effect fires whenever mp.lastResult updates (i.e. when the WebView
    // posts a result back to React Native). This is the correct async pattern:
    // we process the result as an event, not by polling synchronously after send.
    useEffect(() => {
        const result = mp.lastResult;
        if (!result) return;

        const mpMapped: ISLMappedGesture | null = mapGestureToISL(result.gesture, result.score);

        setErrorMsg(null);
        setOnDevice(true);

        if (mpMapped && mpMapped.confidence >= CONFIDENCE_THRESHOLD) {
            setCurrentSign(mpMapped.sign.toUpperCase());
            setCurrentText(mpMapped.text);
            setSignType(mpMapped.type);
            setConfidence(mpMapped.confidence);

            // Avoid repeating the same word — use ref to prevent stale closure
            if (mpMapped.text !== lastSpokenRef.current) {
                speak(mpMapped.text);
                hapticSuccess();
                lastSpokenRef.current = mpMapped.text;
            }
        }
        // Note: when confidence < threshold we intentionally keep the last
        // valid sign visible rather than reverting to "Waiting for sign…"
    }, [mp.lastResult]);

    const confidenceColor = useCallback(() => {
        if (confidence >= 0.85) return '#4ade80';
        if (confidence >= 0.7) return '#fbbf24';
        return '#f87171';
    }, [confidence]);

    const confidenceBar = confidence > 0 ? confidence : 0;

    // ── RC-3 / RC-4 FIX: derive display error (init failure or runtime error) ─
    const displayError = mp.initError ?? errorMsg;

    // ── Download progress (0–100 integer for display) ─────────────────────────
    const downloadPct = Math.round(assets.progress * 100);

    // ── Show download screen while assets are being cached to device ──────────
    if (assets.status === 'downloading' || assets.status === 'idle') {
        return (
            <SafeAreaView style={styles.container}>
                <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => { hapticSelection(); navigation.goBack(); }}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Sign Mode</Text>
                        <Text style={styles.subtitle}>Indian Sign Language (ISL) Detection</Text>
                    </View>
                </LinearGradient>
                <View style={styles.downloadScreen}>
                    <Ionicons name="cloud-download-outline" size={48} color={theme.colors.primary} />
                    <Text style={styles.downloadTitle}>Preparing AI Engine</Text>
                    <Text style={styles.downloadSubtitle}>
                        Downloading MediaPipe (~27 MB) to your device.{`\n`}
                        This happens only once — future launches are instant.
                    </Text>
                    {/* Progress bar */}
                    <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { width: `${downloadPct}%` as any }]} />
                    </View>
                    <Text style={styles.downloadPct}>{downloadPct}%</Text>
                    {assets.currentFile !== '' && (
                        <Text style={styles.downloadFile}>{assets.currentFile}</Text>
                    )}
                </View>
            </SafeAreaView>
        );
    }

    if (assets.status === 'error') {
        return (
            <SafeAreaView style={styles.container}>
                <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => { hapticSelection(); navigation.goBack(); }}
                    >
                        <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Sign Mode</Text>
                    </View>
                </LinearGradient>
                <View style={styles.downloadScreen}>
                    <Ionicons name="cloud-offline-outline" size={48} color="#f87171" />
                    <Text style={[styles.downloadTitle, { color: '#f87171' }]}>Download Failed</Text>
                    <Text style={styles.downloadSubtitle}>{assets.error}</Text>
                    <Text style={[styles.downloadFile, { marginTop: 12 }]}>
                        Check your internet connection and reopen Sign Mode.
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>

            {/* ── Header ── */}
            <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => { hapticSelection(); navigation.goBack(); }}
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>

                <View style={styles.headerContent}>
                    <Text style={styles.title}>Sign Mode</Text>
                    <Text style={styles.subtitle}>Indian Sign Language (ISL) Detection</Text>
                </View>

                {/* Status badge — shows ⚡ On-device or ⏳ Loading */}
                <View style={[
                    styles.islBadge,
                    !mp.isReady && !mp.initError && styles.islBadgeLoading,
                    !!mp.initError && styles.islBadgeError,
                ]}>
                    <Text style={[
                        styles.islBadgeText,
                        !mp.isReady && !mp.initError && styles.islBadgeTextLoading,
                        !!mp.initError && styles.islBadgeTextError,
                    ]}>
                        {mp.initError ? '⚠ Init Failed' : mp.isReady ? '🤟 ISL' : '⏳ Loading…'}
                    </Text>
                </View>
            </LinearGradient>

            <View style={styles.content}>
                {/* ── Camera ── */}
                <View style={styles.cameraWrapper}>
                    <CameraViewComponent cameraRef={cameraRef} label="Show your ISL sign" />

                    {/* Scanning pulse ring */}
                    {isScanning && (
                        <Animated.View
                            style={[styles.scanRing, { transform: [{ scale: pulseAnim }] }]}
                            pointerEvents="none"
                        />
                    )}

                    {/* Scan count chip */}
                    <View style={styles.scanChip}>
                        <View style={[styles.scanDot, { backgroundColor: isScanning ? '#3DEFF5' : '#4ade80' }]} />
                        <Text style={styles.scanChipText}>
                            {isScanning
                                ? 'Analyzing…'
                                : mp.isReady
                                    ? `⚡ On-device · ${scanCount}`
                                    : mp.initError
                                        ? '⚠ MediaPipe error'
                                        : '⏳ Initializing…'}
                        </Text>
                    </View>
                </View>

                {/* ── RC-3/4 FIX: Init error banner ── */}
                {mp.initError && (
                    <View style={styles.initErrorCard}>
                        <Ionicons name="cloud-offline-outline" size={20} color="#f87171" />
                        <View style={styles.initErrorTextCol}>
                            <Text style={styles.initErrorTitle}>MediaPipe Failed to Load</Text>
                            <Text style={styles.initErrorBody}>{mp.initError}</Text>
                        </View>
                    </View>
                )}

                {/* ── Result Card ── */}
                {displayError && !mp.initError ? (
                    <View style={styles.errorCard}>
                        <Ionicons name="alert-circle" size={18} color="#f87171" />
                        <Text style={styles.errorText}>{displayError}</Text>
                    </View>
                ) : !mp.initError ? (
                    <View style={styles.resultCard}>
                        {/* Type badge */}
                        <View style={styles.typeBadgeRow}>
                            <View style={[
                                styles.typeBadge,
                                { backgroundColor: signType === 'letter' ? 'rgba(124,155,247,0.15)' : 'rgba(61,214,255,0.12)' },
                            ]}>
                                <Text style={[
                                    styles.typeBadgeText,
                                    { color: signType === 'letter' ? '#7C9BF7' : theme.colors.primary },
                                ]}>
                                    {signType === 'letter' ? 'FINGERSPELLING' : 'WORD SIGN'}
                                </Text>
                            </View>
                            {confidence > 0 && (
                                <Text style={[styles.confidencePct, { color: confidenceColor() }]}>
                                    {(confidence * 100).toFixed(0)}%
                                </Text>
                            )}
                        </View>

                        {/* Main sign output */}
                        <Text style={styles.signLabel}>ISL Sign</Text>
                        <Text style={styles.signValue} numberOfLines={1} adjustsFontSizeToFit>
                            {currentSign}
                        </Text>

                        {/* English translation */}
                        {currentText !== '' && (
                            <>
                                <Text style={styles.translationLabel}>English</Text>
                                <Text style={styles.translationValue}>{currentText}</Text>
                            </>
                        )}

                        {/* Confidence bar */}
                        {confidence > 0 && (
                            <View style={styles.confBarBg}>
                                <Animated.View
                                    style={[
                                        styles.confBarFill,
                                        {
                                            width: `${Math.round(confidenceBar * 100)}%` as any,
                                            backgroundColor: confidenceColor(),
                                        },
                                    ]}
                                />
                            </View>
                        )}
                    </View>
                ) : null}

                {/* ── Tip ── */}
                <View style={styles.tipCard}>
                    <MaterialCommunityIcons name="hand-wave" size={14} color={theme.colors.primary} />
                    <Text style={styles.tipText}>
                        {/* RC-6 FIX: tip text now matches the actual 1.5 s interval */}
                        Hold your ISL sign steady in front of the camera. Detection runs every 1.5 seconds.
                    </Text>
                </View>
            </View>

            {/* ── Hidden MediaPipe WebView — loads from local file:// URIs (RC-3 fix) ── */}
            <MediaPipeGestureWebView
                ref={mp.webViewRef}
                onReady={mp.onReady}
                onResult={mp.onResult}
                onError={mp.onError}
                localAssets={assets.status === 'ready' && assets.htmlUri ? {
                    htmlUri: assets.htmlUri,
                } : undefined}
            />

        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },

    // ── Download progress screen ──
    downloadScreen: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.xl,
        gap: theme.spacing.md,
    },
    downloadTitle: {
        ...theme.typography.h2,
        color: theme.colors.text,
        textAlign: 'center',
        marginTop: theme.spacing.md,
    },
    downloadSubtitle: {
        ...theme.typography.body,
        color: theme.colors.textMuted,
        textAlign: 'center',
        lineHeight: 22,
    },
    progressBarBg: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
        marginTop: theme.spacing.sm,
    },
    progressBarFill: {
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.primary,
    },
    downloadPct: {
        ...theme.typography.bodyStrong,
        color: theme.colors.primary,
        fontSize: 18,
    },
    downloadFile: {
        ...theme.typography.small,
        color: theme.colors.textMuted,
        fontFamily: 'monospace',
    },

    // ── Header ──
    hero: {
        padding: theme.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: theme.radius.md,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing.sm,
    },
    headerContent: {
        flex: 1,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text,
    },
    subtitle: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        marginTop: 2,
    },
    islBadge: {
        backgroundColor: 'rgba(61,214,255,0.15)',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(61,214,255,0.35)',
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    islBadgeLoading: {
        backgroundColor: 'rgba(251,191,36,0.12)',
        borderColor: 'rgba(251,191,36,0.35)',
    },
    islBadgeError: {
        backgroundColor: 'rgba(248,113,113,0.12)',
        borderColor: 'rgba(248,113,113,0.35)',
    },
    islBadgeText: {
        color: theme.colors.primary,
        fontSize: 12,
        fontWeight: '700',
    },
    islBadgeTextLoading: {
        color: '#fbbf24',
    },
    islBadgeTextError: {
        color: '#f87171',
    },

    // ── Content ──
    content: {
        flex: 1,
        padding: theme.spacing.md,
        gap: theme.spacing.md,
    },

    // ── Camera ──
    cameraWrapper: {
        position: 'relative',
        flex: 1,
        maxHeight: 280,
    },
    scanRing: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#3DEFF5',
        pointerEvents: 'none',
    },
    scanChip: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(10,15,35,0.75)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    scanDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    scanChipText: {
        color: '#e2e8f0',
        fontSize: 11,
        fontWeight: '600',
    },

    // ── Init Error Banner (RC-3/4) ──
    initErrorCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: 'rgba(248,113,113,0.1)',
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.35)',
        padding: theme.spacing.md,
    },
    initErrorTextCol: {
        flex: 1,
        gap: 4,
    },
    initErrorTitle: {
        color: '#f87171',
        fontSize: 13,
        fontWeight: '700',
    },
    initErrorBody: {
        color: '#fca5a5',
        fontSize: 12,
        lineHeight: 17,
    },

    // ── Result Card ──
    resultCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.md,
        gap: 6,
    },
    typeBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    typeBadge: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 3,
    },
    typeBadgeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    confidencePct: {
        fontSize: 13,
        fontWeight: '700',
    },
    signLabel: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
    },
    signValue: {
        fontSize: 40,
        fontWeight: '800',
        color: theme.colors.primary,
        letterSpacing: 1,
    },
    translationLabel: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
        marginTop: 2,
    },
    translationValue: {
        ...theme.typography.bodyStrong,
        color: theme.colors.text,
        fontSize: 20,
    },
    confBarBg: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        marginTop: 8,
        overflow: 'hidden',
    },
    confBarFill: {
        height: 4,
        borderRadius: 2,
    },

    // ── Error ──
    errorCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(248,113,113,0.1)',
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: 'rgba(248,113,113,0.3)',
        padding: theme.spacing.md,
    },
    errorText: {
        ...theme.typography.caption,
        color: '#f87171',
        flex: 1,
    },

    // ── Tip ──
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: 'rgba(61,214,255,0.06)',
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: 'rgba(61,214,255,0.15)',
        padding: theme.spacing.sm,
    },
    tipText: {
        ...theme.typography.small,
        color: theme.colors.primary,
        flex: 1,
        lineHeight: 17,
    },
});
