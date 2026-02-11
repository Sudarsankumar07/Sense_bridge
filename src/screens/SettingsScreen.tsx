import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { getSettings, saveSettings } from '../services/storage';
import { setVoiceSettings } from '../services/voiceEngine';

export const SettingsScreen: React.FC = () => {
    const [voiceSpeed, setVoiceSpeedState] = useState(1);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);

    useEffect(() => {
        const load = async () => {
            const settings = await getSettings();
            setVoiceSpeedState(settings.voiceSpeed);
            setVibrationEnabled(settings.vibrationEnabled);
        };
        load();
    }, []);

    const persist = async (nextVoiceSpeed = voiceSpeed, nextVibration = vibrationEnabled) => {
        await saveSettings({
            voiceSpeed: nextVoiceSpeed,
            vibrationEnabled: nextVibration,
            language: 'en-US',
        });
        setVoiceSettings(nextVoiceSpeed, 'en-US');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                <Text style={styles.title}>Settings</Text>
                <Text style={styles.subtitle}>Tune the experience to your needs.</Text>
            </LinearGradient>

            <View style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Voice Speed</Text>
                    <Text style={styles.cardValue}>{voiceSpeed.toFixed(1)}x</Text>
                    <Slider
                        minimumValue={0.5}
                        maximumValue={2.0}
                        step={0.1}
                        value={voiceSpeed}
                        minimumTrackTintColor={theme.colors.primary}
                        maximumTrackTintColor={theme.colors.border}
                        thumbTintColor={theme.colors.primary}
                        onValueChange={value => setVoiceSpeedState(value)}
                        onSlidingComplete={value => {
                            setVoiceSpeedState(value);
                            persist(value, vibrationEnabled);
                        }}
                    />
                </View>

                <View style={styles.cardRow}>
                    <View>
                        <Text style={styles.cardTitle}>Vibration Feedback</Text>
                        <Text style={styles.cardHint}>Essential for alerts</Text>
                    </View>
                    <Switch
                        value={vibrationEnabled}
                        onValueChange={value => {
                            setVibrationEnabled(value);
                            persist(voiceSpeed, value);
                        }}
                        trackColor={{ false: theme.colors.border, true: theme.colors.primaryDeep }}
                        thumbColor={vibrationEnabled ? theme.colors.primary : '#f4f3f4'}
                    />
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
    hero: {
        padding: theme.spacing.lg,
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
        gap: theme.spacing.lg,
    },
    card: {
        padding: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    cardTitle: {
        ...theme.typography.bodyStrong,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
    },
    cardValue: {
        ...theme.typography.h2,
        color: theme.colors.primary,
        marginBottom: theme.spacing.md,
    },
    cardHint: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        marginTop: 4,
    },
});
