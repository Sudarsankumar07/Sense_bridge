import React, { useRef, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';

type VoiceButtonProps = {
    label: string;
    subLabel?: string;
    onPress: () => void;
    listening?: boolean;
};

export const VoiceButton: React.FC<VoiceButtonProps> = ({ label, subLabel, onPress, listening = false }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (listening) {
            // Pulse animation when listening
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, {
                        toValue: 1.1,
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

            Animated.timing(glowAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: false,
            }).start();
        } else {
            pulseAnim.stopAnimation();
            pulseAnim.setValue(1);
            Animated.timing(glowAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: false,
            }).start();
        }
    }, [listening, pulseAnim, glowAnim]);

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.96,
            ...theme.animations.spring.stiff,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            ...theme.animations.spring.gentle,
            useNativeDriver: true,
        }).start();
    };

    const glowColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['rgba(61, 214, 255, 0)', 'rgba(61, 214, 255, 0.4)'],
    });

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Animated.View
                style={[
                    styles.wrapper,
                    {
                        transform: [{ scale: scaleAnim }],
                        shadowColor: glowColor,
                    }
                ]}
            >
                <LinearGradient colors={theme.gradients.glassCard} style={styles.button}>
                    <Animated.View
                        style={[
                            styles.iconCircle,
                            {
                                transform: [{ scale: pulseAnim }],
                                borderColor: listening ? theme.colors.primary : 'rgba(61,214,255,0.35)',
                            }
                        ]}
                    >
                        <MaterialCommunityIcons
                            name={listening ? "microphone" : "microphone-outline"}
                            size={28}
                            color={theme.colors.primary}
                        />
                    </Animated.View>
                    <View style={styles.textBlock}>
                        <Text style={styles.label}>{label}</Text>
                        {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}
                    </View>
                </LinearGradient>
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: theme.radius.lg,
        ...theme.shadows.lifted,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.md,
        ...theme.glassmorphism.card,
    },
    iconCircle: {
        width: 54,
        height: 54,
        borderRadius: 27,
        backgroundColor: 'rgba(61,214,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: theme.spacing.md,
        borderWidth: 2,
    },
    textBlock: {
        flex: 1,
    },
    label: {
        ...theme.typography.bodyStrong,
        color: theme.colors.text,
    },
    subLabel: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        marginTop: 4,
    },
});
