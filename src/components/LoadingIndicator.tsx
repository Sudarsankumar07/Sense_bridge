import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { theme } from '../theme';

type LoadingIndicatorProps = {
    label?: string;
    size?: 'small' | 'medium' | 'large';
};

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ label = 'Loading', size = 'medium' }) => {
    const spinValue = useRef(new Animated.Value(0)).current;
    const pulseValue = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        // Spin animation
        Animated.loop(
            Animated.timing(spinValue, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();

        // Pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseValue, {
                    toValue: 1.15,
                    duration: 750,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseValue, {
                    toValue: 1,
                    duration: 750,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [spinValue, pulseValue]);

    const spin = spinValue.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    const sizeValue = size === 'small' ? 30 : size === 'large' ? 60 : 45;

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.spinner,
                    {
                        width: sizeValue,
                        height: sizeValue,
                        borderRadius: sizeValue / 2,
                        transform: [{ rotate: spin }, { scale: pulseValue }],
                    },
                ]}
            >
                <View style={[styles.innerCircle, { borderRadius: sizeValue / 2 }]} />
            </Animated.View>
            <Text style={styles.text}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
    },
    spinner: {
        borderWidth: 3,
        borderColor: 'rgba(61, 214, 255, 0.3)',
        borderTopColor: theme.colors.primary,
        ...theme.shadows.glow,
    },
    innerCircle: {
        flex: 1,
        margin: 3,
        backgroundColor: 'rgba(61, 214, 255, 0.1)',
    },
    text: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.sm,
    },
});
