import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';
import { RootStackParamList } from '../types';
import config from '../constants/config';
import { speak } from '../services/voiceEngine';
import { requestPermissions } from '../utils/permissions';

type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC = () => {
    const navigation = useNavigation<SplashScreenNavigationProp>();

    // Animation values
    const logoScale = useRef(new Animated.Value(0)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const orbPulse = useRef(new Animated.Value(1)).current;
    const fadeOut = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const init = async () => {
            // Logo entrance animation
            Animated.parallel([
                Animated.spring(logoScale, {
                    toValue: 1,
                    ...theme.animations.spring.bouncy,
                    useNativeDriver: true,
                }),
                Animated.timing(logoOpacity, {
                    toValue: 1,
                    duration: theme.animations.durations.slow,
                    useNativeDriver: true,
                }),
            ]).start();

            // Text fade in after logo
            setTimeout(() => {
                Animated.timing(textOpacity, {
                    toValue: 1,
                    duration: theme.animations.durations.normal,
                    useNativeDriver: true,
                }).start();
            }, 300);

            // Pulsating orb animation (infinite loop)
            Animated.loop(
                Animated.sequence([
                    Animated.timing(orbPulse, {
                        toValue: 1.15,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                    Animated.timing(orbPulse, {
                        toValue: 1,
                        duration: 1500,
                        useNativeDriver: true,
                    }),
                ])
            ).start();

            await requestPermissions();
            speak(config.MESSAGES.WELCOME, true);

            // Fade out and navigate
            setTimeout(() => {
                Animated.timing(fadeOut, {
                    toValue: 0,
                    duration: theme.animations.durations.normal,
                    useNativeDriver: true,
                }).start(() => {
                    navigation.replace('ModeSelection');
                });
            }, 1100);
        };

        init();
    }, [navigation, logoScale, logoOpacity, textOpacity, orbPulse, fadeOut]);

    return (
        <Animated.View style={[styles.wrapper, { opacity: fadeOut }]}>
            <LinearGradient colors={theme.gradients.hero} style={styles.container}>
                <StatusBar style="light" />
                <Animated.View
                    style={[
                        styles.orb,
                        {
                            transform: [{ scale: orbPulse }],
                            opacity: orbPulse.interpolate({
                                inputRange: [1, 1.15],
                                outputRange: [0.12, 0.18],
                            }),
                        }
                    ]}
                />
                <View style={styles.inner}>
                    <Animated.View
                        style={[
                            styles.logoContainer,
                            {
                                transform: [{ scale: logoScale }],
                                opacity: logoOpacity,
                            }
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="eye-outline"
                            size={72}
                            color={theme.colors.primary}
                        />
                    </Animated.View>
                    <Animated.View style={{ opacity: textOpacity }}>
                        <Text style={styles.title}>SenseBridge</Text>
                        <Text style={styles.subtitle}>Accessibility, reimagined for offline-first AI.</Text>
                    </Animated.View>
                </View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
    },
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    orb: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: '#3dd6ff',
        top: 120,
        right: -60,
        shadowColor: '#3dd6ff',
        shadowOpacity: 0.3,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: 10 },
    },
    inner: {
        alignItems: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    logoContainer: {
        marginBottom: theme.spacing.lg,
    },
    title: {
        ...theme.typography.display,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
        textAlign: 'center',
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.textMuted,
        textAlign: 'center',
    },
});
