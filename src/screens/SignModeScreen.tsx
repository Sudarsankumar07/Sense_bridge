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
import { recognizeSign, ISLDetection } from '../services/cloudAI/signLanguage';
import { speak } from '../services/voiceEngine';
import { hapticSelection, hapticSuccess, hapticWarning } from '../services/haptics';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { captureFrame } from '../utils/camera';

// Minimum confidence to show and speak a result
const CONFIDENCE_THRESHOLD = 0.55;
// How long to wait between captures (ms)
const CAPTURE_INTERVAL_MS = 4500;

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
    const [lastSpoken, setLastSpoken] = useState<string>('');
    const [scanCount, setScanCount] = useState<number>(0);

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

    // ── Main detection loop ──────────────────────────────────────────────────
    useEffect(() => {
        let active = true;

        const loop = async () => {
            while (active) {
                // Pause when screen not focused
                if (!isFocused) {
                    await new Promise(r => setTimeout(r, 500));
                    continue;
                }

                setIsScanning(true);
                startPulse();

                try {
                    const frame = await captureFrame(cameraRef.current);

                    if (!frame?.base64 || !active) {
                        setIsScanning(false);
                        stopPulse();
                        await new Promise(r => setTimeout(r, CAPTURE_INTERVAL_MS));
                        continue;
                    }

                    setScanCount(c => c + 1);
                    const result: ISLDetection = await recognizeSign(frame.base64);

                    if (!active) break;

                    setErrorMsg(null);

                    if (result.confidence >= CONFIDENCE_THRESHOLD && result.sign !== 'none') {
                        setCurrentSign(result.sign.toUpperCase());
                        setCurrentText(result.text);
                        setSignType(result.type);
                        setConfidence(result.confidence);

                        // Speak if it's a new sign (avoid repeating same sign every cycle)
                        if (result.text !== lastSpoken) {
                            speak(result.text);
                            hapticSuccess();
                            setLastSpoken(result.text);
                        }
                    } else if (result.sign === 'none') {
                        // Don't clear previous result — keep showing last known sign
                        setCurrentSign(prev => prev === 'Waiting for sign…' ? 'Waiting for sign…' : prev);
                    }
                } catch (err: any) {
                    if (!active) break;
                    const msg = err?.message ?? 'Detection error';
                    console.error('[SignMode] Detection error:', msg);
                    setErrorMsg(msg);
                    hapticWarning();
                }

                setIsScanning(false);
                stopPulse();
                await new Promise(r => setTimeout(r, CAPTURE_INTERVAL_MS));
            }
        };

        loop();
        return () => { active = false; };
    }, [isFocused]);

    const confidenceColor = useCallback(() => {
        if (confidence >= 0.85) return '#4ade80';
        if (confidence >= 0.7) return '#fbbf24';
        return '#f87171';
    }, [confidence]);

    const confidenceBar = confidence > 0 ? confidence : 0;

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

                {/* ISL badge top-right */}
                <View style={styles.islBadge}>
                    <Text style={styles.islBadgeText}>🤟 ISL</Text>
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
                            {isScanning ? 'Analyzing…' : `Scanned ${scanCount}`}
                        </Text>
                    </View>
                </View>

                {/* ── Result Card ── */}
                {errorMsg ? (
                    <View style={styles.errorCard}>
                        <Ionicons name="alert-circle" size={18} color="#f87171" />
                        <Text style={styles.errorText}>{errorMsg}</Text>
                    </View>
                ) : (
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
                )}

                {/* ── Tip ── */}
                <View style={styles.tipCard}>
                    <MaterialCommunityIcons name="hand-wave" size={14} color={theme.colors.primary} />
                    <Text style={styles.tipText}>
                        Hold your ISL sign steady in front of the camera. Detection runs every 2.5 seconds.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
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
    islBadgeText: {
        color: theme.colors.primary,
        fontSize: 12,
        fontWeight: '700',
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
