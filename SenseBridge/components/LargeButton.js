import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import voiceEngine from '../services/voiceEngine';
import * as Haptics from 'expo-haptics';

export default function LargeButton({ title, onPress, icon, disabled = false, variant = 'primary' }) {
    const handlePress = async () => {
        // Speak button label
        await voiceEngine.speak(title);

        // Haptic feedback
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Execute callback
        if (onPress) {
            onPress();
        }
    };

    const buttonStyle = [
        styles.button,
        variant === 'primary' && styles.primaryButton,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'danger' && styles.dangerButton,
        disabled && styles.disabledButton
    ];

    const textStyle = [
        styles.buttonText,
        variant === 'secondary' && styles.secondaryText,
        disabled && styles.disabledText
    ];

    return (
        <TouchableOpacity
            style={buttonStyle}
            onPress={handlePress}
            disabled={disabled}
            accessible={true}
            accessibilityLabel={title}
            accessibilityRole="button"
            accessibilityState={{ disabled }}
        >
            <View style={styles.content}>
                {icon && <Text style={styles.icon}>{icon}</Text>}
                <Text style={textStyle}>{title}</Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    button: {
        width: '85%',
        minHeight: 70,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: 10,
        paddingHorizontal: 20,
        paddingVertical: 15,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    primaryButton: {
        backgroundColor: '#2196F3',
    },
    secondaryButton: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#2196F3',
    },
    dangerButton: {
        backgroundColor: '#f44336',
    },
    disabledButton: {
        backgroundColor: '#ccc',
        elevation: 0,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    icon: {
        fontSize: 32,
        marginRight: 15,
    },
    buttonText: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    secondaryText: {
        color: '#2196F3',
    },
    disabledText: {
        color: '#999',
    },
});
