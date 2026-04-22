import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { theme } from '../theme';
import { RootStackParamList, AppMode } from '../types';
import config from '../constants/config';
import { ModeCard, VoiceButton } from '../components';
import { listenForCommand, speakAndWait, speak } from '../services/voiceEngine';
import { hapticSelection } from '../services/haptics';
import { setLastMode } from '../services/storage';
import { safeNormalize } from '../utils/stringUtils';

type ModeSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'ModeSelection'>;

const modeOrder: AppMode[] = [AppMode.BLIND, AppMode.SIGN, AppMode.DEAF];

export const ModeSelectionScreen: React.FC = () => {
    const navigation = useNavigation<ModeSelectionNavigationProp>();
    const [listening, setListening] = useState(false);
    const [statusText, setStatusText] = useState('Initializing voice...');
    const activeRef = useRef(true);

    const navigateToMode = useCallback(async (mode: AppMode) => {
        activeRef.current = false; // stop the voice loop
        await setLastMode(mode);
        hapticSelection();
        speak(config.MESSAGES.MODE_SELECTED(config.MODES[mode].title));
        navigation.navigate(mode === AppMode.BLIND ? 'BlindMode' : mode === AppMode.SIGN ? 'SignMode' : 'DeafMode');
    }, [navigation]);

    const matchVoiceCommand = useCallback((text: string | null | undefined): AppMode | null => {
        const normalized = safeNormalize(text);
        if (!normalized) return null;
        if (config.VOICE_COMMANDS.BLIND_MODE.some(cmd => normalized.includes(cmd))) {
            return AppMode.BLIND;
        }
        if (config.VOICE_COMMANDS.SIGN_MODE.some(cmd => normalized.includes(cmd))) {
            return AppMode.SIGN;
        }
        if (config.VOICE_COMMANDS.DEAF_MODE.some(cmd => normalized.includes(cmd))) {
            return AppMode.DEAF;
        }
        return null;
    }, []);

    const startVoiceLoop = useCallback(async () => {
        if (!activeRef.current) return;

        // Speak the welcome prompt and wait for it to finish
        setStatusText('Speaking...');
        await speakAndWait(config.MESSAGES.WELCOME);

        // Voice prompt loop: listen → match → navigate or retry
        while (activeRef.current) {
            setListening(true);
            setStatusText('Listening... speak now');

            const result = await listenForCommand(4000);

            setListening(false);

            if (!activeRef.current) break;

            if (result.text) {
                setStatusText(`Heard: "${result.text}"`);
                const mode = matchVoiceCommand(result.text);

                if (mode) {
                    await navigateToMode(mode);
                    return; // done
                } else {
                    // Not recognized — retry
                    setStatusText('Not recognized, retrying...');
                    await speakAndWait("I didn't catch that. Please say Blind Mode, Sign Mode, or Deaf Mode.");
                }
            } else {
                // No speech detected — retry
                setStatusText('No speech detected, retrying...');
                await speakAndWait("I didn't hear anything. Please try again.");
            }
        }
    }, [matchVoiceCommand, navigateToMode]);

    useEffect(() => {
        activeRef.current = true;

        // Small delay so the screen renders before speaking
        const timer = setTimeout(() => {
            startVoiceLoop();
        }, 500);

        return () => {
            activeRef.current = false;
            clearTimeout(timer);
        };
    }, [startVoiceLoop]);

    // Also allow manual trigger via VoiceButton tap
    const handleVoiceButtonPress = () => {
        if (!listening) {
            activeRef.current = true;
            startVoiceLoop();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                <View style={styles.heroGlow} />
                <Text style={styles.eyebrow}>SenseBridge</Text>
                <Text style={styles.title}>Choose how you want to connect today.</Text>
                <Text style={styles.subtitle}>Voice-first, always available offline.</Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={styles.voiceCard}>
                    <VoiceButton
                        label={listening ? 'Listening... speak now' : statusText}
                        subLabel="Say Blind Mode, Sign Mode, or Deaf Mode"
                        onPress={handleVoiceButtonPress}
                        listening={listening}
                    />
                </View>

                <View style={styles.cards}>
                    {modeOrder.map(mode => (
                        <ModeCard
                            key={mode}
                            icon={config.MODES[mode].icon}
                            title={config.MODES[mode].title}
                            description={config.MODES[mode].description}
                            tag="Offline"
                            onPress={() => navigateToMode(mode)}
                        />
                    ))}
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
        paddingHorizontal: theme.spacing.xl,
        paddingTop: theme.spacing.xxl + 10,
        paddingBottom: theme.spacing.xl,
    },
    heroGlow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(124,255,178,0.15)',
        right: -60,
        top: 10,
    },
    eyebrow: {
        ...theme.typography.caption,
        color: theme.colors.accent,
        textTransform: 'uppercase',
        letterSpacing: 2,
        fontWeight: '700',
        marginBottom: theme.spacing.xs,
    },
    title: {
        ...theme.typography.display,
        color: theme.colors.text,
        marginTop: theme.spacing.sm,
        marginBottom: theme.spacing.sm,
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.xs,
    },
    scrollContent: {
        flexGrow: 1,
        padding: theme.spacing.xl,
        paddingBottom: theme.spacing.xxl * 2,
    },
    voiceCard: {
        marginBottom: theme.spacing.xl,
    },
    cards: {
        gap: theme.spacing.xl,
    },
});
