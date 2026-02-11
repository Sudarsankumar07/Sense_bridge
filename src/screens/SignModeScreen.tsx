import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'expo-camera';
import { theme } from '../theme';
import { CameraViewComponent } from '../components';
import { recognizeSign } from '../services/cloudAI/signLanguage';
import { speak } from '../services/voiceEngine';
import { hapticSelection } from '../services/haptics';

export const SignModeScreen: React.FC = () => {
    const cameraRef = useRef<Camera>(null);
    const [currentSign, setCurrentSign] = useState('Waiting for sign...');
    const [confidence, setConfidence] = useState(0);

    useEffect(() => {
        const interval = setInterval(async () => {
            const detection = await recognizeSign();
            setCurrentSign(detection.text);
            setConfidence(detection.confidence);
            speak(detection.text, true);
            hapticSelection();
        }, 3000);

        return () => clearInterval(interval);
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                <Text style={styles.title}>Sign Mode</Text>
                <Text style={styles.subtitle}>Hands to words, instantly.</Text>
            </LinearGradient>

            <View style={styles.content}>
                <CameraViewComponent cameraRef={cameraRef} label="Sign capture" />
                <View style={styles.outputCard}>
                    <Text style={styles.outputLabel}>Recognized</Text>
                    <Text style={styles.outputText}>{currentSign}</Text>
                    <Text style={styles.confidence}>Confidence: {(confidence * 100).toFixed(0)}%</Text>
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
    outputCard: {
        padding: theme.spacing.lg,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    outputLabel: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
    },
    outputText: {
        ...theme.typography.h1,
        color: theme.colors.primary,
        marginTop: theme.spacing.sm,
    },
    confidence: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.sm,
    },
});
