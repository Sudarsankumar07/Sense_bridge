import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function VoiceFeedback({ isListening, partialText = '' }) {
    const [pulseAnim] = useState(new Animated.Value(1));

    useEffect(() => {
        if (isListening) {
            // Start pulsing animation
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.3,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(pulseAnim, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                ])
            ).start();
        } else {
            // Stop animation
            pulseAnim.setValue(1);
        }
    }, [isListening]);

    if (!isListening && !partialText) {
        return null;
    }

    return (
        <View style={styles.container}>
            {isListening && (
                <Animated.View
                    style={[
                        styles.microphoneIcon,
                        { transform: [{ scale: pulseAnim }] }
                    ]}
                >
                    <Text style={styles.micText}>🎤</Text>
                </Animated.View>
            )}

            <View style={styles.textContainer}>
                <Text style={styles.statusText}>
                    {isListening ? 'Listening...' : 'Processing...'}
                </Text>
                {partialText ? (
                    <Text style={styles.partialText}>{partialText}</Text>
                ) : null}
            </View>

            <View style={styles.waveformContainer}>
                {isListening && (
                    <>
                        <View style={[styles.bar, styles.bar1]} />
                        <View style={[styles.bar, styles.bar2]} />
                        <View style={[styles.bar, styles.bar3]} />
                        <View style={[styles.bar, styles.bar4]} />
                        <View style={[styles.bar, styles.bar5]} />
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1976D2',
        borderRadius: 20,
        padding: 20,
        width: '90%',
        alignItems: 'center',
        marginVertical: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    microphoneIcon: {
        marginBottom: 15,
    },
    micText: {
        fontSize: 48,
    },
    textContainer: {
        alignItems: 'center',
        marginBottom: 15,
    },
    statusText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    partialText: {
        color: '#E3F2FD',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 5,
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
        gap: 5,
    },
    bar: {
        width: 6,
        backgroundColor: '#fff',
        borderRadius: 3,
    },
    bar1: {
        height: 20,
        animation: 'wave 0.8s infinite',
    },
    bar2: {
        height: 30,
        animation: 'wave 0.8s infinite 0.1s',
    },
    bar3: {
        height: 40,
        animation: 'wave 0.8s infinite 0.2s',
    },
    bar4: {
        height: 30,
        animation: 'wave 0.8s infinite 0.3s',
    },
    bar5: {
        height: 20,
        animation: 'wave 0.8s infinite 0.4s',
    },
});
