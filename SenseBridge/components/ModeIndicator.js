import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ModeIndicator({ mode, hint = '' }) {
    const getModeConfig = () => {
        switch (mode) {
            case 'blind':
                return {
                    icon: '🦯',
                    title: 'BLIND MODE',
                    color: '#FF9800',
                    hint: hint || 'Say "Check Currency" to scan money'
                };
            case 'sign':
                return {
                    icon: '👋',
                    title: 'SIGN MODE',
                    color: '#4CAF50',
                    hint: hint || 'Show hand signs to camera'
                };
            case 'deaf':
                return {
                    icon: '🧏',
                    title: 'DEAF MODE',
                    color: '#9C27B0',
                    hint: hint || 'Speak to see sign language'
                };
            default:
                return {
                    icon: '🌉',
                    title: 'SENSEBRIDGE',
                    color: '#2196F3',
                    hint: hint || ''
                };
        }
    };

    const config = getModeConfig();

    return (
        <View style={[styles.container, { backgroundColor: config.color }]}>
            <View style={styles.header}>
                <Text style={styles.icon}>{config.icon}</Text>
                <Text style={styles.title}>{config.title}</Text>
            </View>
            {config.hint ? (
                <Text style={styles.hint}>{config.hint}</Text>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingVertical: 15,
        paddingHorizontal: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 28,
        marginRight: 10,
    },
    title: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
    },
    hint: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 5,
        opacity: 0.9,
    },
});
