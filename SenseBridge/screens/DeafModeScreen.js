import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    StatusBar,
    ScrollView,
    ActivityIndicator
} from 'react-native';
import LargeButton from '../components/LargeButton';
import ModeIndicator from '../components/ModeIndicator';
import VoiceFeedback from '../components/VoiceFeedback';
import voiceEngine from '../services/voiceEngine';
import decisionEngine from '../services/decisionEngine';

export default function DeafModeScreen({ navigation }) {
    const [isListening, setIsListening] = useState(false);
    const [recognizedText, setRecognizedText] = useState('');
    const [transcript, setTranscript] = useState([]);
    const [currentAnimation, setCurrentAnimation] = useState('');
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        initializeMode();

        return () => {
            // Cleanup
            stopListening();
            decisionEngine.reset();
        };
    }, []);

    const initializeMode = async () => {
        // Initialize Unity avatar (will use native module)
        console.log('Initializing Unity avatar...');

        setTimeout(async () => {
            setIsInitializing(false);
            await voiceEngine.speak(
                'Deaf Mode activated. Speak and watch the avatar perform sign language.'
            );
        }, 1000);
    };

    const startListening = async () => {
        setIsListening(true);
        setRecognizedText('');

        // Start continuous listening with Vosk
        await voiceEngine.startListening(
            (finalText) => {
                // Got final result
                if (finalText.trim()) {
                    processSpeech(finalText);
                }
            },
            (partialText) => {
                // Got partial result
                setRecognizedText(partialText);
            }
        );
    };

    const stopListening = async () => {
        setIsListening(false);
        await voiceEngine.stopListening();
        setRecognizedText('');
    };

    const processSpeech = async (text) => {
        // Add to transcript
        setTranscript(prev => [{ text, timestamp: Date.now() }, ...prev]);

        // Normalize text
        const normalized = text.toLowerCase().trim();
        const words = normalized.split(' ');

        // Process each word
        for (const word of words) {
            await processWord(word);
        }
    };

    const processWord = async (word) => {
        // This will use Unity native module
        // For now, simulate animation

        const knownSigns = [
            'hello', 'thank', 'you', 'please', 'yes', 'no', 'help',
            'sorry', 'good', 'bad', 'morning', 'night', 'name',
            'my', 'your', 'what', 'where', 'when', 'how'
        ];

        if (knownSigns.includes(word)) {
            // Play animation
            setCurrentAnimation(word);
            console.log(`Playing animation: ${word}`);

            const event = {
                type: 'speech_recognized',
                mode: 'deaf',
                data: { text: word },
                confidence: 1.0
            };

            await decisionEngine.processEvent(event);

            // Simulate animation duration
            await new Promise(resolve => setTimeout(resolve, 1500));

        } else {
            // Spell out word
            setCurrentAnimation(`Spelling: ${word}`);
            console.log(`Spelling word: ${word}`);

            const event = {
                type: 'unknown_word',
                mode: 'deaf',
                data: { word },
                confidence: 1.0
            };

            await decisionEngine.processEvent(event);

            // Spell each letter
            for (const letter of word) {
                console.log(`Spelling letter: ${letter}`);
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }

        setCurrentAnimation('');
    };

    const clearTranscript = async () => {
        setTranscript([]);
        await voiceEngine.speak('Transcript cleared');
    };

    const handleExit = async () => {
        await stopListening();
        await voiceEngine.speak('Exiting Deaf Mode');
        navigation.goBack();
    };

    if (isInitializing) {
        return (
            <SafeAreaView style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="#9C27B0" />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#9C27B0" />
                    <Text style={styles.loadingText}>Initializing Avatar...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#9C27B0" />

            <ModeIndicator mode="deaf" hint={isListening ? 'Listening...' : "Tap 'Start Listening'"} />

            {/* Avatar Container */}
            <View style={styles.avatarContainer}>
                <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarEmoji}>🧑</Text>
                    <Text style={styles.avatarText}>3D Avatar</Text>
                    <Text style={styles.avatarSubtext}>Unity integration pending</Text>
                </View>

                {currentAnimation && (
                    <View style={styles.animationLabel}>
                        <Text style={styles.animationText}>{currentAnimation}</Text>
                    </View>
                )}
            </View>

            {/* Transcript Area */}
            <View style={styles.transcriptContainer}>
                <View style={styles.transcriptHeader}>
                    <Text style={styles.transcriptTitle}>Transcript</Text>
                    {transcript.length > 0 && (
                        <LargeButton
                            title="Clear"
                            icon="🗑️"
                            onPress={clearTranscript}
                            variant="secondary"
                        />
                    )}
                </View>

                <ScrollView style={styles.transcriptScroll}>
                    {transcript.length === 0 ? (
                        <Text style={styles.emptyText}>No speech detected yet</Text>
                    ) : (
                        transcript.map((item, index) => (
                            <View key={index} style={styles.transcriptItem}>
                                <Text style={styles.transcriptText}>{item.text}</Text>
                                <Text style={styles.transcriptTime}>
                                    {new Date(item.timestamp).toLocaleTimeString()}
                                </Text>
                            </View>
                        ))
                    )}
                </ScrollView>
            </View>

            {/* Voice Feedback */}
            {isListening && (
                <VoiceFeedback isListening={isListening} partialText={recognizedText} />
            )}

            {/* Controls */}
            <View style={styles.controls}>
                <View style={styles.buttonRow}>
                    {!isListening ? (
                        <LargeButton
                            title="Start Listening"
                            icon="🎤"
                            onPress={startListening}
                        />
                    ) : (
                        <LargeButton
                            title="Stop Listening"
                            icon="⏹️"
                            onPress={stopListening}
                            variant="danger"
                        />
                    )}

                    <LargeButton
                        title="Exit"
                        icon="🏠"
                        onPress={handleExit}
                        variant="secondary"
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1a1a1a',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 20,
        fontSize: 18,
        color: '#9C27B0',
        fontWeight: 'bold',
    },
    avatarContainer: {
        height: 300,
        backgroundColor: '#2a2a2a',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    avatarPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarEmoji: {
        fontSize: 100,
    },
    avatarText: {
        color: '#9C27B0',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 10,
    },
    avatarSubtext: {
        color: '#aaa',
        fontSize: 14,
        marginTop: 5,
    },
    animationLabel: {
        position: 'absolute',
        bottom: 20,
        backgroundColor: 'rgba(156, 39, 176, 0.9)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    animationText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    transcriptContainer: {
        flex: 1,
        backgroundColor: '#1a1a1a',
        padding: 15,
    },
    transcriptHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    transcriptTitle: {
        color: '#9C27B0',
        fontSize: 20,
        fontWeight: 'bold',
    },
    transcriptScroll: {
        flex: 1,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 20,
    },
    transcriptItem: {
        backgroundColor: '#2a2a2a',
        padding: 15,
        borderRadius: 10,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: '#9C27B0',
    },
    transcriptText: {
        color: '#fff',
        fontSize: 18,
        marginBottom: 5,
    },
    transcriptTime: {
        color: '#aaa',
        fontSize: 12,
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
