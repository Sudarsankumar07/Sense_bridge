import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useIsFocused } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView } from 'expo-camera';
import { theme } from '../theme';
import { CameraViewComponent, AlertModal } from '../components';
import { captureFrame } from '../utils/camera';
import { detectObjects } from '../services/cloudAI/objectDetection';
import { detectCurrency } from '../services/cloudAI/currencyRecognition';
import { buildObstacleAlert, buildCurrencyAlert, shouldTriggerAlert } from '../utils/decisionEngine';
import { hapticWarning, hapticSuccess, hapticSelection } from '../services/haptics';
import { speak } from '../services/voiceEngine';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { CloudError, RootStackParamList } from '../types';

export const BlindModeScreen: React.FC = () => {
    const navigation = useNavigation<StackNavigationProp<RootStackParamList, 'BlindMode'>>();
    const isFocused = useIsFocused();
    const cameraRef = useRef<CameraView>(null);
    const [obstacleActive, setObstacleActive] = useState(true);
    const [currencyActive, setCurrencyActive] = useState(false);
    const [status, setStatus] = useState('Scanning environment');
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertText, setAlertText] = useState('');
    const [cloudError, setCloudError] = useState<string | null>(null);

    const toggleObstacle = useCallback(() => {
        setObstacleActive(prev => {
            const next = !prev;
            speak(next ? 'Obstacle scan on' : 'Obstacle scan off');
            hapticSelection();
            return next;
        });
    }, []);

    const toggleCurrency = useCallback(() => {
        setCurrencyActive(prev => {
            const next = !prev;
            speak(next ? 'Currency scan on' : 'Currency scan off');
            hapticSelection();
            return next;
        });
    }, []);

    useVoiceCommands({
        intro: 'Blind mode. Say obstacle, currency, or navigate to toggle. Say go back to return.',
        commands: {
            obstacle: toggleObstacle,
            currency: toggleCurrency,
            navigate: () => { hapticSelection(); navigation.navigate('Navigation'); },
            back: () => { hapticSelection(); navigation.goBack(); },
        },
    });



    const handleCloudError = (error: unknown) => {
        if (error && typeof error === 'object' && 'source' in error) {
            const ce = error as CloudError;
            const msg = `[${ce.provider}] ${ce.message}`;
            console.error(`[SenseBridge] CloudError:`, msg);
            setCloudError(msg);
            setStatus(`Error: ${ce.message}`);
            setAlertText(msg);
            setAlertVisible(true);
        } else {
            const msg = error instanceof Error ? error.message : 'Unknown detection error';
            console.error('[SenseBridge] Detection error:', msg);
            setCloudError(msg);
            setStatus(`Error: ${msg}`);
        }
    };

    useEffect(() => {
        let active = true;

        const loop = async () => {
            while (active) {
                // Pause detection when screen is not focused (e.g., NavigationScreen is active)
                if (!isFocused) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                    continue;
                }

                const frame = await captureFrame(cameraRef.current);

                if (frame?.base64 && active) {
                    // Clear previous error on new successful frame capture
                    setCloudError(null);

                    if (obstacleActive) {
                        try {
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
                                setStatus(`${first.class} – ${first.distance?.toFixed(1)}m away`);
                            }
                        } catch (error) {
                            handleCloudError(error);
                        }
                    }

                    if (currencyActive) {
                        try {
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
                        } catch (error) {
                            handleCloudError(error);
                        }
                    }
                }

                // Wait 2 seconds before next capture
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        };

        loop();

        return () => { active = false; };
    }, [obstacleActive, currencyActive, isFocused]);

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
                <Text style={styles.title}>Blind Mode</Text>
                <Text style={styles.subtitle}>Real-time obstacle and currency awareness.</Text>
            </LinearGradient>

            <View style={styles.content}>
                <CameraViewComponent cameraRef={cameraRef} label={status} />

                <View style={styles.controls}>
                    <TouchableOpacity
                        style={[styles.toggle, obstacleActive && styles.toggleActive]}
                        onPress={toggleObstacle}
                    >
                        <Text style={styles.toggleText}>Obstacle Scan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.toggle, currencyActive && styles.toggleActive]}
                        onPress={toggleCurrency}
                    >
                        <Text style={styles.toggleText}>Currency Scan</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.navToggle}
                        onPress={() => { hapticSelection(); navigation.navigate('Navigation'); }}
                    >
                        <Text style={styles.toggleText}>Navigate</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.statusCard, cloudError ? styles.statusCardError : null]}>
                    <Text style={styles.statusLabel}>{cloudError ? 'Cloud Error' : 'Live Status'}</Text>
                    <Text style={[styles.statusValue, cloudError ? styles.statusValueError : null]}>
                        {status}
                    </Text>
                </View>
            </View>

            <AlertModal
                visible={alertVisible}
                title={cloudError ? 'Cloud Error' : 'Alert'}
                message={alertText}
                severity={cloudError ? 'danger' : 'warning'}
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
    navToggle: {
        flex: 1,
        padding: theme.spacing.sm,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: theme.colors.accent,
        backgroundColor: 'rgba(124,255,178,0.12)',
        alignItems: 'center',
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
    statusCardError: {
        borderColor: '#ff4444',
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
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
    statusValueError: {
        color: '#ff4444',
    },
});
