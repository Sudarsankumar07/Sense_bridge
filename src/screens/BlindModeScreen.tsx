import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera } from 'expo-camera';
import { theme } from '../theme';
import { CameraViewComponent, AlertModal } from '../components';
import { captureFrame, throttle } from '../utils/camera';
import { detectObjects } from '../services/cloudAI/objectDetection';
import { detectCurrency } from '../services/cloudAI/currencyRecognition';
import { buildObstacleAlert, buildCurrencyAlert, shouldTriggerAlert } from '../utils/decisionEngine';
import { hapticWarning, hapticSuccess } from '../services/haptics';
import { speak } from '../services/voiceEngine';
import config from '../constants/config';

export const BlindModeScreen: React.FC = () => {
    const cameraRef = useRef<typeof Camera>(null);
    const [obstacleActive, setObstacleActive] = useState(true);
    const [currencyActive, setCurrencyActive] = useState(false);
    const [status, setStatus] = useState('Scanning environment');
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertText, setAlertText] = useState('');

    const lastFrameRef = useRef(0);

    useEffect(() => {
        const interval = setInterval(async () => {
            if (!throttle(lastFrameRef.current, config.CAMERA.FRAME_RATE)) {
                return;
            }
            lastFrameRef.current = Date.now();
            const frame = await captureFrame(cameraRef.current);
            if (!frame?.base64) return;

            if (obstacleActive) {
                const detections = await detectObjects(frame.base64);
                const first = detections[0];
                if (first) {
                    const alert = buildObstacleAlert(first);
                    if (alert && shouldTriggerAlert(alert.id)) {
                        setAlertText(alert.message);
                        setAlertVisible(true);
                        hapticWarning();
                        speak(alert.message);
                    }
                    setStatus(`${first.class} � ${first.distance?.toFixed(1)}m away`);
                }
            }

            if (currencyActive) {
                const currency = await detectCurrency(frame.base64);
                if (currency) {
                    const alert = buildCurrencyAlert(currency);
                    if (shouldTriggerAlert(alert.id, 4000)) {
                        setAlertText(alert.message);
                        setAlertVisible(true);
                        hapticSuccess();
                        speak(alert.message);
                    }
                    setStatus(`${currency.denomination} INR detected`);
                }
            }
        }, 1200);

        return () => clearInterval(interval);
    }, [obstacleActive, currencyActive]);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                <Text style={styles.title}>Blind Mode</Text>
                <Text style={styles.subtitle}>Real-time obstacle and currency awareness.</Text>
            </LinearGradient>

            <View style={styles.content}>
                <CameraViewComponent cameraRef={cameraRef} label={status} />

                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.toggle, obstacleActive && styles.toggleActive]}
                        onPress={() => setObstacleActive(prev => !prev)}
                    >
                        <Text style={styles.toggleText}>Obstacle Scan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggle, currencyActive && styles.toggleActive]}
                        onPress={() => setCurrencyActive(prev => !prev)}
                    >
                        <Text style={styles.toggleText}>Currency Scan</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.statusCard}>
                    <Text style={styles.statusLabel}>Live Status</Text>
                    <Text style={styles.statusValue}>{status}</Text>
                </View>
            </View>

            <AlertModal
                visible={alertVisible}
                title="Alert"
                message={alertText}
                severity="warning"
                onClose={() => setAlertVisible(false)}
            />
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
    controls: {
        flexDirection: 'row',
        gap: theme.spacing.md,
    },
    toggle: {
        flex: 1,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
    },
    toggleActive: {
        backgroundColor: 'rgba(61,214,255,0.15)',
        borderColor: theme.colors.primary,
    },
    toggleText: {
        ...theme.typography.caption,
        color: theme.colors.text,
    },
    statusCard: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
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
});
