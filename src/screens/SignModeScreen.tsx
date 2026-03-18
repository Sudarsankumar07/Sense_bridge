import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView } from 'expo-camera';
import { theme } from '../theme';
import { CameraViewComponent } from '../components';
import { recognizeSign } from '../services/cloudAI/signLanguage';
import { speak } from '../services/voiceEngine';
import { hapticSelection } from '../services/haptics';
import { useVoiceCommands } from '../hooks/useVoiceCommands';

export const SignModeScreen: React.FC = () => {
    const navigation = useNavigation();
    const cameraRef = useRef<CameraView>(null);
    const [currentSign, setCurrentSign] = useState('Waiting for sign...');
    const [confidence, setConfidence] = useState(0);

    useVoiceCommands({
        intro: 'Sign mode activated. Say go back to return.',
        commands: {
            back: () => { hapticSelection(); navigation.goBack(); },
        },
    });

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
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => {
                        hapticSelection();
                        navigation.goBack();
                    }}
                >
                    <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
                </TouchableOpacity>
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
