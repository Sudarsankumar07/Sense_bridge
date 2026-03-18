import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import config from '../constants/config';
import { hapticSelection } from '../services/haptics';
import { AvatarView } from '../components';
import { listenForCommand, speakAndWait } from '../services/voiceEngine';

export const DeafModeScreen: React.FC = () => {
    const navigation = useNavigation();
    const [currentTranscript, setCurrentTranscript] = useState('');
    const [avatarReady, setAvatarReady] = useState(false);
    const [currentEmotion] = useState<string>('neutral');

    // Handle avatar ready
    const handleAvatarReady = useCallback(() => {
        console.log('[DeafMode] Avatar is ready');
        setAvatarReady(true);
        hapticSelection();
    }, []);

    // Handle avatar error
    const handleAvatarError = useCallback((error: string) => {
        console.error('[DeafMode] Avatar error:', error);
        Alert.alert('Avatar Error', error);
    }, []);

    useEffect(() => {
        let active = true;

        const runLoop = async () => {
            await speakAndWait('Deaf mode activated. I am listening. Say go back to return.');

            while (active) {
                const result = await listenForCommand(3500);
                if (!active) break;

                const text = (result.text || '').trim();
                if (!text) {
                    continue;
                }

                const normalized = text.toLowerCase();
                if (config.VOICE_COMMANDS.BACK.some(cmd => normalized.includes(cmd))) {
                    hapticSelection();
                    navigation.goBack();
                    return;
                }

                setCurrentTranscript(text);
            }
        };

        runLoop();
        return () => { active = false; };
    }, [navigation]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        hapticSelection();
                        navigation.goBack();
                    }}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Deaf Mode</Text>
                <Text style={styles.subtitle}>Speech to text with avatar-ready output.</Text>
            </LinearGradient>

            <View style={styles.content}>
                <View style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>Listening</Text>
                            <Text style={styles.statusValue}>Live transcription</Text>
                        </View>
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>Avatar</Text>
                            <Text style={[styles.statusValue, avatarReady ? styles.statusReady : styles.statusLoading]}>
                                {avatarReady ? '✓ Ready' : '⏳ Loading'}
                            </Text>
                        </View>
                    </View>
                </View>

                <AvatarView
                    transcriptText={currentTranscript}
                    visible={true}
                    emotion={currentEmotion}
                    onReady={handleAvatarReady}
                    onError={handleAvatarError}
                />
            </View>
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
    avatarContainer: {
        marginBottom: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
    },
    statusCard: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: theme.spacing.lg,
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: theme.spacing.md,
    },
    statusItem: {
        flex: 1,
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
});
