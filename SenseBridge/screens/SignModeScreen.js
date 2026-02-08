import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Dimensions,
    ScrollView
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import LargeButton from '../components/LargeButton';
import ModeIndicator from '../components/ModeIndicator';
import voiceEngine from '../services/voiceEngine';
import decisionEngine from '../services/decisionEngine';

const { width, height } = Dimensions.get('window');

export default function SignModeScreen({ navigation }) {
    const [permission, requestPermission] = useCameraPermissions();
    const [isDetecting, setIsDetecting] = useState(false);
    const [currentSign, setCurrentSign] = useState('');
    const [phraseBuffer, setPhraseBuffer] = useState([]);
    const [confidence, setConfidence] = useState(0);
    const detectionIntervalRef = useRef(null);
    const phraseTimerRef = useRef(null);
    const cameraRef = useRef(null);

    useEffect(() => {
        initializeMode();

        return () => {
            // Cleanup
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
            if (phraseTimerRef.current) {
                clearTimeout(phraseTimerRef.current);
            }
            decisionEngine.reset();
        };
    }, []);

    const initializeMode = async () => {
        await voiceEngine.speak(
            'Sign Mode activated. Show hand signs to the camera. Words will appear on screen and be spoken.'
        );

        if (permission?.granted) {
            startSignDetection();
        }
    };

    const startSignDetection = () => {
        setIsDetecting(true);

        // Process frames every 300ms (~3 FPS)
        detectionIntervalRef.current = setInterval(async () => {
            if (cameraRef.current) {
                await processFrameForSigns();
            }
        }, 300);
    };

    const processFrameForSigns = async () => {
        // This will use MediaPipe + TFLite native modules
        // Placeholder for now

        // Mock sign detection for testing
        if (__DEV__) {
            const random = Math.random();
            if (random > 0.97) {
                const mockSigns = ['hello', 'thank you', 'please', 'yes', 'no', 'help'];
                const sign = mockSigns[Math.floor(Math.random() * mockSigns.length)];
                const conf = 0.6 + Math.random() * 0.3;

                const event = {
                    type: 'sign_recognized',
                    mode: 'sign',
                    data: {
                        text: sign
                    },
                    confidence: conf
                };

                const output = await decisionEngine.processEvent(event);
                if (output) {
                    setCurrentSign(sign);
                    setConfidence(conf);
                    addToPhrase(sign);
                }
            }
        }
    };

    const addToPhrase = (word) => {
        setPhraseBuffer(prev => [...prev, word]);

        // Reset phrase timer
        if (phraseTimerRef.current) {
            clearTimeout(phraseTimerRef.current);
        }

        // After 3 seconds of no new signs, speak the phrase
        phraseTimerRef.current = setTimeout(() => {
            speakPhrase();
        }, 3000);
    };

    const speakPhrase = async () => {
        if (phraseBuffer.length > 0) {
            const phrase = phraseBuffer.join(' ');
            await voiceEngine.speak(phrase);
        }
    };

    const clearPhrase = async () => {
        setPhraseBuffer([]);
        setCurrentSign('');
        if (phraseTimerRef.current) {
            clearTimeout(phraseTimerRef.current);
        }
        await voiceEngine.speak('Phrase cleared');
    };

    const handleExit = async () => {
        await voiceEngine.speak('Exiting Sign Mode');
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
                <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />
                <ModeIndicator mode="sign" />

                <View style={styles.permissionContainer}>
                    <Text style={styles.permissionText}>
                        Camera permission is required for sign language recognition
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
            <StatusBar barStyle="light-content" backgroundColor="#4CAF50" />

            <ModeIndicator mode="sign" hint="Show hand signs to camera" />

            <View style={styles.cameraContainer}>
                <CameraView
                    ref={cameraRef}
                    style={styles.camera}
                    facing="front"
                />

                <View style={styles.overlay}>
                    <View style={styles.handGuide}>
                        <Text style={styles.guideText}>Place hands here 👋</Text>
                    </View>
                </View>
            </View>

            <View style={styles.displayArea}>
                <Text style={styles.currentSignLabel}>Current Sign:</Text>
                <Text style={styles.currentSignText}>
                    {currentSign || 'Waiting...'}
                </Text>
                {confidence > 0 && (
                    <Text style={styles.confidence}>
                        Confidence: {Math.round(confidence * 100)}%
                    </Text>
                )}

                <View style={styles.phraseContainer}>
                    <Text style={styles.phraseLabel}>Phrase:</Text>
                    <ScrollView horizontal style={styles.phraseScroll}>
                        <Text style={styles.phraseText}>
                            {phraseBuffer.length > 0 ? phraseBuffer.join(' ') : 'No words yet'}
                        </Text>
                    </ScrollView>
                </View>
            </View>

            <View style={styles.controls}>
                <View style={styles.buttonRow}>
                    <LargeButton
                        title="Clear Phrase"
                        icon="🗑️"
                        onPress={clearPhrase}
                        variant="secondary"
                        disabled={phraseBuffer.length === 0}
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
        height: height * 0.4,
        position: 'relative',
    },
    camera: {
        width: width,
        height: '100%',
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    handGuide: {
        borderWidth: 3,
        borderColor: '#4CAF50',
        borderRadius: 20,
        padding: 10,
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
    },
    guideText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    displayArea: {
        backgroundColor: '#1a1a1a',
        padding: 20,
        flex: 1,
    },
    currentSignLabel: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    currentSignText: {
        color: '#fff',
        fontSize: 48,
        fontWeight: 'bold',
        textAlign: 'center',
        marginVertical: 10,
    },
    confidence: {
        color: '#aaa',
        fontSize: 16,
        textAlign: 'center',
    },
    phraseContainer: {
        marginTop: 20,
        padding: 15,
        backgroundColor: '#2a2a2a',
        borderRadius: 10,
    },
    phraseLabel: {
        color: '#4CAF50',
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    phraseScroll: {
        maxHeight: 80,
    },
    phraseText: {
        color: '#fff',
        fontSize: 22,
        lineHeight: 30,
    },
    controls: {
        backgroundColor: '#212121',
        paddingVertical: 15,
        paddingHorizontal: 10,
    },
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
});
