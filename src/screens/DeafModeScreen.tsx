import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

export const DeafModeScreen: React.FC = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>🧏 Deaf Mode</Text>
            <Text style={styles.subtitle}>Speech to Text</Text>
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
    title: {
        ...theme.typography.h1,
        color: theme.colors.primary,
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        marginTop: theme.spacing.sm,
    },
});
