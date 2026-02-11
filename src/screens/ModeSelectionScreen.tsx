import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { theme } from '../theme';
import { RootStackParamList, AppMode } from '../types';
import config from '../constants/config';
import { ModeCard, VoiceButton } from '../components';
import { listenForCommand, speak } from '../services/voiceEngine';
import { hapticSelection } from '../services/haptics';
import { setLastMode } from '../services/storage';

type ModeSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'ModeSelection'>;

const modeOrder: AppMode[] = [AppMode.BLIND, AppMode.SIGN, AppMode.DEAF];

export const ModeSelectionScreen: React.FC = () => {
    const navigation = useNavigation<ModeSelectionNavigationProp>();
    const [listening, setListening] = useState(false);

    const navigateToMode = async (mode: AppMode) => {
        await setLastMode(mode);
        hapticSelection();
        speak(config.MESSAGES.MODE_SELECTED(config.MODES[mode].title));
        navigation.navigate(mode === AppMode.BLIND ? 'BlindMode' : mode === AppMode.SIGN ? 'SignMode' : 'DeafMode');
    };

    useEffect(() => {
        const runVoicePrompt = async () => {
            setListening(true);
            const result = await listenForCommand();
            if (result.text) {
                const normalized = result.text.toLowerCase();
                if (config.VOICE_COMMANDS.BLIND_MODE.some(cmd => normalized.includes(cmd))) {
                    await navigateToMode(AppMode.BLIND);
                } else if (config.VOICE_COMMANDS.SIGN_MODE.some(cmd => normalized.includes(cmd))) {
                    await navigateToMode(AppMode.SIGN);
                } else if (config.VOICE_COMMANDS.DEAF_MODE.some(cmd => normalized.includes(cmd))) {
                    await navigateToMode(AppMode.DEAF);
                }
            }
            setListening(false);
        };

        runVoicePrompt();
    }, []);

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
                        label={listening ? 'Listening for a mode...' : 'Tap to start voice mode selection'}
                        subLabel="Say Blind Mode, Sign Mode, or Deaf Mode"
                        onPress={() => speak(config.MESSAGES.WELCOME, true)}
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
        padding: theme.spacing.xl,
        paddingBottom: theme.spacing.xxl + 20,
    },
    voiceCard: {
        marginBottom: theme.spacing.xl,
    },
    cards: {
        gap: theme.spacing.xl,
    },
});
