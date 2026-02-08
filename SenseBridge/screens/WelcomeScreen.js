import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, StatusBar, SafeAreaView, ActivityIndicator } from 'react-native';
import LargeButton from '../components/LargeButton';
import VoiceFeedback from '../components/VoiceFeedback';
import ModeIndicator from '../components/ModeIndicator';
import voiceEngine from '../services/voiceEngine';
import storageService from '../services/storageService';

export default function WelcomeScreen({ navigation }) {
    const [isListening, setIsListening] = useState(false);
    const [isInitializing, setIsInitializing] = useState(true);
    const [recognizedText, setRecognizedText] = useState('');
    const [attemptCount, setAttemptCount] = useState(0);

    useEffect(() => {
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            // Initialize database
            await storageService.initializeDatabase();

            // Initialize voice engine
            await voiceEngine.initializeVosk();

            // Wait a moment for everything to settle
            setTimeout(async () => {
                setIsInitializing(false);

                // Greet user
                await voiceEngine.speak(
                    'Welcome to SenseBridge. Say Blind Mode, Sign Mode, or Deaf Mode to begin.',
                    {
                        onDone: () => {
                            // Start listening after greeting
                            startVoiceSelection();
                        }
                    }
                );
            }, 500);
        } catch (error) {
            console.error('Initialization error:', error);
            setIsInitializing(false);
        }
    };

    const startVoiceSelection = async () => {
        setIsListening(true);
        setRecognizedText('');

        // Start listening for voice command
        await voiceEngine.startListening(
            (finalText) => {
                // Got final result
                setIsListening(false);
                setRecognizedText(finalText);
                handleVoiceCommand(finalText);
            },
            (partialText) => {
                // Got partial result
                setRecognizedText(partialText);
            }
        );

        // Set timeout for listening (10 seconds)
        setTimeout(() => {
            if (isListening) {
                stopListening();
            }
        }, 10000);
    };

    const stopListening = async () => {
        await voiceEngine.stopListening();
        setIsListening(false);

        if (attemptCount < 1) {
            // Try again once
            setAttemptCount(attemptCount + 1);
            await voiceEngine.speak('I did not hear you. Please try again.');
            setTimeout(() => startVoiceSelection(), 1000);
        } else {
            // Show visual menu after 2 attempts
            await voiceEngine.speak('Showing visual menu. Please select a mode.');
        }
    };

    const handleVoiceCommand = async (text) => {
        const command = voiceEngine.parseVoiceCommand(text);

        if (command.type === 'mode_select') {
            await navigateToMode(command.mode);
        } else {
            // Unknown command
            await voiceEngine.speak('I did not understand. Please try again.');
            setTimeout(() => startVoiceSelection(), 1500);
        }
    };

    const navigateToMode = async (mode) => {
        await storageService.setLastMode(mode);

        let message = '';
        let screen = '';

        switch (mode) {
            case 'blind':
                message = 'Opening Blind Mode';
                screen = 'BlindMode';
                break;
            case 'sign':
                message = 'Opening Sign Mode';
                screen = 'SignMode';
                break;
            case 'deaf':
                message = 'Opening Deaf Mode';
                screen = 'DeafMode';
                break;
        }

        await voiceEngine.speak(message);

        setTimeout(() => {
            navigation.navigate(screen);
        }, 1000);
    };

    if (isInitializing) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#2196F3" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text style={styles.loadingText}>Initializing SenseBridge...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#2196F3" />

            <ModeIndicator mode="welcome" hint="Say 'Exit' to quit" />

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={styles.title}>🌉 SenseBridge</Text>
                    <Text style={styles.subtitle}>Choose Your Mode</Text>
                </View>

                {isListening && (
                    <VoiceFeedback isListening={isListening} partialText={recognizedText} />
                )}

                <View style={styles.buttonContainer}>
                    <LargeButton
                        title="Blind Mode"
                        icon="🦯"
                        onPress={() => navigateToMode('blind')}
                    />

                    <LargeButton
                        title="Sign Mode"
                        icon="👋"
                        onPress={() => navigateToMode('sign')}
                        variant="secondary"
                    />

                    <LargeButton
                        title="Deaf Mode"
                        icon="🧏"
                        onPress={() => navigateToMode('deaf')}
                    />
                </View>

                {!isListening && (
                    <LargeButton
                        title="Use Voice Command"
                        icon="🎤"
                        onPress={startVoiceSelection}
                        variant="secondary"
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 18,
        color: '#666',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 20,
    },
    header: {
        alignItems: 'center',
        marginVertical: 20,
    },
    title: {
        fontSize: 42,
        fontWeight: 'bold',
        color: '#2196F3',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 24,
        color: '#666',
        fontWeight: '600',
    },
    buttonContainer: {
        width: '100%',
        alignItems: 'center',
        gap: 10,
    },
});
