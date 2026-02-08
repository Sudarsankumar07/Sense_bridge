import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Dimensions
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import LargeButton from '../components/LargeButton';
import ModeIndicator from '../components/ModeIndicator';
import voiceEngine from '../services/voiceEngine';
import decisionEngine from '../services/decisionEngine';

const { width, height } = Dimensions.get('window');

export default function BlindModeScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [isDetecting, setIsDetecting] = useState(false);
    const [isCurrencyMode, setIsCurrencyMode] = useState(false);
    const [lastAlert, setLastAlert] = useState(null);
    const detectionIntervalRef = useRef(null);
    const cameraRef = useRef(null);

    useEffect(() => {
        initializeMode();

        return () => {
            // Cleanup
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
            decisionEngine.reset();
        };
    }, []);

    const initializeMode = async () => {
        await voiceEngine.speak(
            'Blind Mode activated. Camera will detect obstacles. Say Check Currency to scan money.'
        );

        if (permission?.granted) {
            startObstacleDetection();
        }
    };

    const startObstacleDetection = () => {
        setIsDetecting(true);

        // Process frames every 500ms (2 FPS) to save battery
        detectionIntervalRef.current = setInterval(async () => {
            if (cameraRef.current && !isCurrencyMode) {
                await processFrameForObstacles();
            }
        }, 500);
    };

    const processFrameForObstacles = async () => {
        // This will use native TFLite module
        // Placeholder for now

        // Mock obstacle detection
        if (__DEV__) {
            // Simulate random obstacles for testing
            const random = Math.random();
            if (random > 0.95) {
                const mockEvent = {
                    type: 'person_detected',
                    mode: 'blind',
                    data: {
                        class: 'person',
                        distance: '2 meters'
                    },
                    confidence: 0.85
                };

                const output = await decisionEngine.processEvent(mockEvent);
                if (output) {
                    setLastAlert(output.display);
                }
            }
        }
    };

    const handleCheckCurrency = async () => {
        setIsCurrencyMode(true);
        await voiceEngine.speak('Point camera at currency note. Hold steady.');

        // Capture multiple frames over 2 seconds
        setTimeout(async () => {
            await processCurrency();
        }, 2000);
    };

    const processCurrency = async () => {
        // This will use native TFLite currency model
        // Placeholder for now

        // Mock currency detection
        const mockCurrencies = ['Ten rupees', 'Twenty rupees', 'Fifty rupees', 'One hundred rupees', 'Five hundred rupees'];
        const detected = mockCurrencies[Math.floor(Math.random() * mockCurrencies.length)];

        const event = {
            type: 'currency_detected',
            mode: 'blind',
            data: {
                denomination: detected
            },
            confidence: 0.9
        };

        const output = await decisionEngine.processEvent(event);
        if (output) {
            setLastAlert(output.display);
        }

        setIsCurrencyMode(false);
    };

    const handleExit = async () => {
        await voiceEngine.speak('Exiting Blind Mode');
        if (detectionIntervalRef.current) {
            clearInterval(detectionIntervalRef.current);
        }
        navigation.goBack();
    };

    if (!permission) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    if (!permission.granted) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#FF9800" />
                <ModeIndicator mode="blind" />

                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>
                        Camera permission is required for obstacle detection
                    </Text>
                    <LargeButton
                        title="Grant Camera Permission"
                        icon="📷"
                        onPress={requestPermission}
                    />
                    <LargeButton
                        title="Go Back"
                        onPress={handleExit}
                        variant="secondary"
                    />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#FF9800" />

            <ModeIndicator mode="blind" hint="Say 'Check Currency' or 'Exit'" />

            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="back"
                />

                {lastAlert && (
                    <View style={[styles.alertOverlay, getAlertStyle(lastAlert.type)]}>
                        <Text style={styles.alertMessage}>{lastAlert.message}</Text>
                        {lastAlert.details && (
                            <Text style={styles.alertDetails}>{lastAlert.details}</Text>
                        )}
                    </View>
                )}

                {isCurrencyMode && (
                    <View style={styles.currencyOverlay}>
                        <ActivityIndicator size="large" color="#fff" />
                        <Text style={styles.currencyText}>Scanning Currency...</Text>
                    </View>
                )}
            </View>

            <View style={styles.controls}>
                <View style={styles.status}>
                    <Text style={styles.statusText}>
                        {isDetecting ? '✓ Obstacle Detection Active' : '○ Detection Paused'}
                    </Text>
                </View>

                <View style={styles.buttonRow}>
                    <LargeButton
                        title="Check Currency"
                        icon="💵"
                        onPress={handleCheckCurrency}
                        disabled={isCurrencyMode}
                    />

                    <LargeButton
                        title="Exit"
                        icon="🏠"
                        onPress={handleExit}
                        variant="danger"
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}

function getAlertStyle(type) {
    switch (type) {
        case 'alert':
            return { backgroundColor: 'rgba(244, 67, 54, 0.9)' };
        case 'success':
            return { backgroundColor: 'rgba(76, 175, 80, 0.9)' };
        case 'warning':
            return { backgroundColor: 'rgba(255, 152, 0, 0.9)' };
        default:
            return { backgroundColor: 'rgba(33, 150, 243, 0.9)' };
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    permissionText: {
        fontSize: 20,
        textAlign: 'center',
        marginBottom: 30,
        color: '#333',
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    camera: {
        width: width,
        height: height * 0.6,
    },
    alertOverlay: {
        position: 'absolute',
        top: 20,
        left: 20,
        right: 20,
        padding: 20,
        borderRadius: 15,
        elevation: 10,
    },
    alertMessage: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    alertDetails: {
        color: '#fff',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 8,
    },
    currencyOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    currencyText: {
        color: '#fff',
        fontSize: 22,
        marginTop: 20,
        fontWeight: 'bold',
    },
    controls: {
        backgroundColor: '#212121',
        paddingVertical: 15,
        paddingHorizontal: 10,
    },
    status: {
        alignItems: 'center',
        marginBottom: 10,
    },
    statusText: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: 'bold',
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
});
