import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { theme } from '../theme';
import { RootStackParamList } from '../types';

type SplashScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Splash'>;

export const SplashScreen: React.FC = () => {
    const navigation = useNavigation<SplashScreenNavigationProp>();

    useEffect(() => {
        // Navigate to mode selection after 2 seconds
        const timer = setTimeout(() => {
            navigation.replace('ModeSelection');
        }, 2000);

        return () => clearTimeout(timer);
    }, [navigation]);

    return (
        <View style={styles.container}>
            <Text style={styles.text}>🌉</Text>
            <Text style={styles.title}>SenseBridge</Text>
            <Text style={styles.subtitle}>Loading...</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 80,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.primary,
        marginTop: theme.spacing.lg,
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        marginTop: theme.spacing.sm,
    },
});
