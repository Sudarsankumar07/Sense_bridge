import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface AvatarCanvasProps {
    onReady?: (mixer: any) => void;
    onError?: (message: string) => void;
    onBonesDetected?: (bones: string[], reportPath: string) => void;
}

export const AvatarCanvas: React.FC<AvatarCanvasProps> = () => {
    return (
        <View style={styles.container}>
            <View style={styles.labelPill}>
                <Text style={styles.labelText}>Web Fallback</Text>
            </View>
            <View style={styles.centerContent}>
                <Text style={styles.title}>Avatar Preview Unavailable on Web</Text>
                <Text style={styles.subtitle}>
                    Run on Expo Go (Android/iOS) to load the local GLB avatar.
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 340,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#0b1021',
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.25)',
        marginBottom: 16,
    },
    centerContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    title: {
        color: '#e2e8f0',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        color: '#94a3b8',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    labelPill: {
        position: 'absolute',
        top: 12,
        right: 12,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        zIndex: 2,
    },
    labelText: {
        color: '#e2e8f0',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
});
