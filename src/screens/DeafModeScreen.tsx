import React, { useCallback, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Animated,
    Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as THREE from 'three';
import { theme } from '../theme';
import { hapticSelection, hapticSuccess } from '../services/haptics';
import { AvatarCanvas } from '../components/AvatarCanvas';
import { createSignEngine } from '../hooks/useSignEngine';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const DeafModeScreen: React.FC = () => {
    const navigation = useNavigation();
    const scrollRef = useRef<ScrollView>(null);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const signEngineRef = useRef<ReturnType<typeof createSignEngine> | null>(null);

    const [inputText, setInputText] = useState('');
    const [avatarStatus, setAvatarStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [statusMessage, setStatusMessage] = useState('Loading avatar model...');
    const [lastSignedText, setLastSignedText] = useState('');
    const [isSigning, setIsSigning] = useState(false);
    const [boneCount, setBoneCount] = useState(0);

    // Animated ring glow on the avatar border when signing
    const glowAnim = useRef(new Animated.Value(0)).current;
    const glowLoop = useRef<Animated.CompositeAnimation | null>(null);

    const startGlow = () => {
        glowLoop.current = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, { toValue: 1, duration: 700, useNativeDriver: false }),
                Animated.timing(glowAnim, { toValue: 0.3, duration: 700, useNativeDriver: false }),
            ])
        );
        glowLoop.current.start();
    };
    const stopGlow = () => {
        glowLoop.current?.stop();
        Animated.timing(glowAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    };

    const handleBack = useCallback(() => {
        hapticSelection();
        navigation.goBack();
    }, [navigation]);

    const handleAvatarReady = useCallback((mixer: THREE.AnimationMixer) => {
        mixerRef.current = mixer;
        signEngineRef.current = createSignEngine(mixer);
        setAvatarStatus('ready');
        setStatusMessage('Avatar ready — type text and tap Play');
    }, []);

    const handleAvatarError = useCallback((message: string) => {
        setAvatarStatus('error');
        setStatusMessage(message);
    }, []);

    const handleBonesDetected = useCallback((bones: string[], _reportPath: string) => {
        setBoneCount(bones.length);
    }, []);

    const handleSign = useCallback(async () => {
        const engine = signEngineRef.current;
        if (!engine || !inputText.trim()) return;

        // ── Step 1: Scroll to top so avatar is fully visible ──
        scrollRef.current?.scrollTo({ y: 0, animated: true });

        // ── Step 2: Small delay to let scroll settle, then play ──
        await new Promise(r => setTimeout(r, 350));

        hapticSuccess();
        setIsSigning(true);
        setLastSignedText(inputText.trim());
        startGlow();

        try {
            engine.stop();
            await engine.playText(inputText);
        } finally {
            setTimeout(() => {
                setIsSigning(false);
                stopGlow();
            }, 300);
        }
    }, [inputText, glowAnim]);

    const isReadyToSign =
        avatarStatus === 'ready' && !!signEngineRef.current && !!inputText.trim();

    const borderColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(124,255,178,0.25)', 'rgba(124,255,178,0.95)'],
    });
    const shadowOpacity = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.8],
    });

    const getStatusColor = () => {
        if (avatarStatus === 'ready') return '#4ade80';
        if (avatarStatus === 'error') return '#f87171';
        return '#fbbf24';
    };

    const getStatusIcon = () => {
        if (avatarStatus === 'ready') return 'checkmark-circle';
        if (avatarStatus === 'error') return 'alert-circle';
        return 'time';
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* ── Compact Header ── */}
            <LinearGradient colors={theme.gradients.hero} style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                    accessibilityLabel="Go back"
                >
                    <Ionicons name="arrow-back" size={22} color={theme.colors.text} />
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <Text style={styles.title}>Deaf Mode</Text>
                    <View style={styles.statusBadge}>
                        <Ionicons
                            name={getStatusIcon() as any}
                            size={12}
                            color={getStatusColor()}
                        />
                        <Text style={[styles.statusBadgeText, { color: getStatusColor() }]}>
                            {avatarStatus === 'loading'
                                ? 'Loading avatar…'
                                : avatarStatus === 'error'
                                    ? 'Avatar error'
                                    : `${boneCount} bones · Ready`}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                {/* ── Avatar Canvas — large, zoomed ── */}
                <Animated.View
                    style={[
                        styles.avatarWrapper,
                        {
                            borderColor,
                            shadowOpacity,
                            shadowColor: '#7cffb2',
                        },
                    ]}
                >
                    {/* Signing badge overlay */}
                    {isSigning && (
                        <View style={styles.signingBadge}>
                            <MaterialCommunityIcons
                                name="hand-wave"
                                size={14}
                                color="#052e16"
                            />
                            <Text style={styles.signingBadgeText}>Signing</Text>
                        </View>
                    )}

                    <AvatarCanvas
                        onReady={handleAvatarReady}
                        onError={handleAvatarError}
                        onBonesDetected={handleBonesDetected}
                    />
                </Animated.View>

                {/* ── Currently signing label ── */}
                {lastSignedText ? (
                    <View style={styles.lastSignedRow}>
                        <MaterialCommunityIcons
                            name="sign-language"
                            size={16}
                            color={theme.colors.accent}
                        />
                        <Text style={styles.lastSignedText} numberOfLines={1}>
                            {isSigning ? `Signing: "${lastSignedText}"` : `Last: "${lastSignedText}"`}
                        </Text>
                    </View>
                ) : null}

                {/* ── Input section ── */}
                <View style={styles.inputCard}>
                    <Text style={styles.inputLabel}>
                        <MaterialCommunityIcons
                            name="keyboard"
                            size={14}
                            color={theme.colors.textMuted}
                        />
                        {'  '}Type text to sign
                    </Text>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="e.g. hello, yes, no, thank you…"
                        placeholderTextColor={theme.colors.textMuted}
                        multiline
                        maxLength={120}
                        returnKeyType="done"
                        accessibilityLabel="Text to sign"
                    />
                    <Text style={styles.charCount}>{inputText.length}/120</Text>
                </View>

                {/* ── Play button ── */}
                <TouchableOpacity
                    style={[styles.playButton, !isReadyToSign && styles.playButtonDisabled]}
                    onPress={handleSign}
                    disabled={!isReadyToSign}
                    accessibilityLabel="Play sign animation"
                    accessibilityRole="button"
                    activeOpacity={0.82}
                >
                    <LinearGradient
                        colors={
                            isReadyToSign
                                ? ['#22c55e', '#16a34a']
                                : ['rgba(34,197,94,0.3)', 'rgba(22,163,74,0.3)']
                        }
                        style={styles.playGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        {isSigning ? (
                            <>
                                <MaterialCommunityIcons name="hand-wave" size={22} color="#052e16" />
                                <Text style={styles.playText}>Signing…</Text>
                            </>
                        ) : (
                            <>
                                <Ionicons
                                    name="play-circle"
                                    size={22}
                                    color={isReadyToSign ? '#052e16' : theme.colors.textMuted}
                                />
                                <Text
                                    style={[
                                        styles.playText,
                                        !isReadyToSign && styles.playTextDisabled,
                                    ]}
                                >
                                    Play Sign Animation
                                </Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                {/* ── Tip card ── */}
                {!isSigning && avatarStatus === 'ready' && (
                    <View style={styles.tipCard}>
                        <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
                        <Text style={styles.tipText}>
                            Tap Play — screen auto-scrolls up to show the full avatar signing animation.
                        </Text>
                    </View>
                )}

                {/* Loading / error state */}
                {avatarStatus !== 'ready' && (
                    <View style={styles.statusCard}>
                        <Ionicons
                            name={getStatusIcon() as any}
                            size={20}
                            color={getStatusColor()}
                        />
                        <Text style={[styles.statusMessage, { color: getStatusColor() }]}>
                            {statusMessage}
                        </Text>
                    </View>
                )}

                <View style={styles.bottomPad} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },

    // ── Header ──
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.md,
        paddingBottom: theme.spacing.md,
        gap: theme.spacing.sm,
    },
    backButton: {
        width: 38,
        height: 38,
        borderRadius: theme.radius.md,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
    },
    title: {
        ...theme.typography.h2,
        color: theme.colors.text,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 2,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '500',
    },

    // ── Scroll ──
    scroll: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: theme.spacing.md,
        paddingTop: theme.spacing.sm,
    },

    // ── Avatar ──
    avatarWrapper: {
        borderRadius: 22,
        overflow: 'hidden',
        borderWidth: 2,
        marginBottom: theme.spacing.sm,
        // Android elevation for glow effect
        elevation: 10,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 0 },
    },

    signingBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        zIndex: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#22c55e',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    signingBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#052e16',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },

    // ── Last Signed Row ──
    lastSignedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: theme.spacing.md,
        paddingHorizontal: 4,
    },
    lastSignedText: {
        ...theme.typography.caption,
        color: theme.colors.accent,
        flex: 1,
    },

    // ── Input ──
    inputCard: {
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
    },
    inputLabel: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
        marginBottom: theme.spacing.sm,
    },
    input: {
        minHeight: 64,
        color: theme.colors.text,
        ...theme.typography.body,
        textAlignVertical: 'top',
    },
    charCount: {
        ...theme.typography.small,
        color: theme.colors.textMuted,
        textAlign: 'right',
        marginTop: 4,
    },

    // ── Play Button ──
    playButton: {
        borderRadius: theme.radius.pill,
        overflow: 'hidden',
        marginBottom: theme.spacing.md,
        elevation: 6,
    },
    playButtonDisabled: {
        elevation: 0,
        opacity: 0.6,
    },
    playGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 16,
        paddingHorizontal: theme.spacing.xl,
    },
    playText: {
        ...theme.typography.bodyStrong,
        fontSize: 17,
        color: '#052e16',
    },
    playTextDisabled: {
        color: theme.colors.textMuted,
    },

    // ── Tip ──
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: 'rgba(61,214,255,0.07)',
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: 'rgba(61,214,255,0.18)',
        padding: theme.spacing.sm,
        marginBottom: theme.spacing.md,
    },
    tipText: {
        ...theme.typography.small,
        color: theme.colors.primary,
        flex: 1,
        lineHeight: 18,
    },

    // ── Status ──
    statusCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
        marginBottom: theme.spacing.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    statusMessage: {
        ...theme.typography.caption,
        flex: 1,
    },

    bottomPad: {
        height: 40,
    },
});
