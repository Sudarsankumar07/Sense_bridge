import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import * as THREE from 'three';
import { theme } from '../theme';
import { hapticSelection } from '../services/haptics';
import { AvatarCanvas } from '../components/AvatarCanvas';
import { createSignEngine } from '../hooks/useSignEngine';

export const DeafModeScreen: React.FC = () => {
    const navigation = useNavigation();
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const signEngineRef = useRef<ReturnType<typeof createSignEngine> | null>(null);
    const [inputText, setInputText] = useState('');
    const [avatarStatus, setAvatarStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [statusMessage, setStatusMessage] = useState('Loading avatar model...');
    const [lastSignedText, setLastSignedText] = useState('');
    const [isSigning, setIsSigning] = useState(false);
    const [boneCount, setBoneCount] = useState(0);
    const [boneReportPath, setBoneReportPath] = useState('');

    const handleBack = useCallback(() => {
        hapticSelection();
        navigation.goBack();
    }, [navigation]);

    // Create sign engine immediately when the mixer is available — do NOT use useMemo
    const handleAvatarReady = useCallback((mixer: THREE.AnimationMixer) => {
        mixerRef.current = mixer;
        signEngineRef.current = createSignEngine(mixer);
        setAvatarStatus('ready');
        setStatusMessage('Avatar ready for signing.');
    }, []);

    const handleAvatarError = useCallback((message: string) => {
        setAvatarStatus('error');
        setStatusMessage(message);
    }, []);

    const handleBonesDetected = useCallback((bones: string[], reportPath: string) => {
        setBoneCount(bones.length);
        setBoneReportPath(reportPath);
    }, []);

    const handleSign = useCallback(async () => {
        const engine = signEngineRef.current;
        if (!engine || !inputText.trim()) {
            return;
        }

        setIsSigning(true);
        setLastSignedText(inputText.trim());
        try {
            engine.stop();
            await engine.playText(inputText);
        } finally {
            setTimeout(() => setIsSigning(false), 300);
        }
    }, [inputText]);

    const isReadyToSign = avatarStatus === 'ready' && !!signEngineRef.current && !!inputText.trim();

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={handleBack}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Deaf Mode</Text>
                <Text style={styles.subtitle}>Type text and play sign animation</Text>
            </LinearGradient>

            <ScrollView style={styles.content}>
                <AvatarCanvas
                    onReady={handleAvatarReady}
                    onError={handleAvatarError}
                    onBonesDetected={handleBonesDetected}
                />

                <View style={styles.statusCard}>
                    <Text style={styles.statusLabel}>Avatar Status</Text>
                    <Text style={[
                        styles.statusValue,
                        avatarStatus === 'ready'
                            ? styles.statusReady
                            : avatarStatus === 'error'
                                ? styles.statusError
                                : styles.statusLoading,
                    ]}
                    >
                        {avatarStatus.toUpperCase()}
                    </Text>
                    <Text style={styles.statusDetail}>{statusMessage}</Text>
                    <Text style={styles.statusDetail}>Bones detected: {boneCount}</Text>
                    {boneReportPath ? (
                        <Text style={styles.statusDetail} numberOfLines={1}>
                            Bone report: {boneReportPath}
                        </Text>
                    ) : null}
                </View>

                <View style={styles.captionCard}>
                    <Text style={styles.cardTitle}>Input Text</Text>
                    <TextInput
                        style={styles.input}
                        value={inputText}
                        onChangeText={setInputText}
                        placeholder="Type text for avatar signing... (try: hello, yes, no)"
                        placeholderTextColor={theme.colors.textMuted}
                        multiline
                    />
                </View>

                <TouchableOpacity
                    style={[
                        styles.toggleButton,
                        !isReadyToSign && styles.disabledButton,
                    ]}
                    onPress={handleSign}
                    disabled={!isReadyToSign}
                >
                    <Text style={styles.toggleText}>{isSigning ? 'Signing...' : 'Play Sign Animation'}</Text>
                </TouchableOpacity>

                <View style={styles.captionCard}>
                    <Text style={styles.cardTitle}>Last Signed Text</Text>
                    <Text style={styles.cardBody}>{lastSignedText || 'No sign played yet.'}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    hero: {
        padding: theme.spacing.lg,
        position: 'relative',
    },
    backButton: {
        position: 'absolute',
        top: theme.spacing.md,
        left: theme.spacing.md,
        width: 40,
        height: 40,
        borderRadius: theme.radius.md,
        backgroundColor: 'rgba(0,0,0,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text,
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.sm,
    },
    content: {
        flex: 1,
        padding: theme.spacing.lg,
    },
    statusCard: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: theme.spacing.lg,
    },
    statusLabel: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
    },
    statusValue: {
        ...theme.typography.bodyStrong,
        color: theme.colors.text,
        marginTop: theme.spacing.sm,
    },
    statusReady: {
        color: '#4ade80',
    },
    statusLoading: {
        color: '#fbbf24',
    },
    statusError: {
        color: '#f87171',
    },
    statusDetail: {
        ...theme.typography.body,
        color: theme.colors.text,
        marginTop: theme.spacing.xs,
    },
    captionCard: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: theme.spacing.md,
    },
    toggleButton: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: '#22c55e',
        alignItems: 'center',
        marginBottom: theme.spacing.lg,
        marginTop: theme.spacing.sm,
    },
    disabledButton: {
        opacity: 0.5,
    },
    toggleText: {
        ...theme.typography.bodyStrong,
        color: '#052e16',
    },
    cardTitle: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
        marginBottom: theme.spacing.xs,
    },
    cardBody: {
        ...theme.typography.body,
        color: theme.colors.text,
    },
    input: {
        minHeight: 72,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        color: theme.colors.text,
        backgroundColor: 'rgba(15, 23, 42, 0.38)',
        textAlignVertical: 'top',
    },
});
