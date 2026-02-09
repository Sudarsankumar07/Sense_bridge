import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { RootStackParamList, AppMode } from '../types';
import config from '../constants/config';

type ModeSelectionNavigationProp = StackNavigationProp<RootStackParamList, 'ModeSelection'>;

export const ModeSelectionScreen: React.FC = () => {
    const navigation = useNavigation<ModeSelectionNavigationProp>();

    const handleModeSelect = (mode: AppMode) => {
        switch (mode) {
            case AppMode.BLIND:
                navigation.navigate('BlindMode');
                break;
            case AppMode.SIGN:
                navigation.navigate('SignMode');
                break;
            case AppMode.DEAF:
                navigation.navigate('DeafMode');
                break;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Text style={styles.title}>🌉 SenseBridge</Text>
                    <Text style={styles.subtitle}>Choose Your Accessibility Mode</Text>
                </View>

                <View style={styles.modesContainer}>
                    {/* Blind Mode Card */}
                    <TouchableOpacity
                        style={styles.modeCard}
                        onPress={() => handleModeSelect(AppMode.BLIND)}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#1a1a1a', '#2a2a2a']}
                            style={styles.cardGradient}
                        >
                            <Text style={styles.modeIcon}>{config.MODES[AppMode.BLIND].icon}</Text>
                            <Text style={styles.modeTitle}>{config.MODES[AppMode.BLIND].title}</Text>
                            <Text style={styles.modeDescription}>
                                {config.MODES[AppMode.BLIND].description}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Sign Mode Card */}
                    <TouchableOpacity
                        style={styles.modeCard}
                        onPress={() => handleModeSelect(AppMode.SIGN)}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#1a1a1a', '#2a2a2a']}
                            style={styles.cardGradient}
                        >
                            <Text style={styles.modeIcon}>{config.MODES[AppMode.SIGN].icon}</Text>
                            <Text style={styles.modeTitle}>{config.MODES[AppMode.SIGN].title}</Text>
                            <Text style={styles.modeDescription}>
                                {config.MODES[AppMode.SIGN].description}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Deaf Mode Card */}
                    <TouchableOpacity
                        style={styles.modeCard}
                        onPress={() => handleModeSelect(AppMode.DEAF)}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['#1a1a1a', '#2a2a2a']}
                            style={styles.cardGradient}
                        >
                            <Text style={styles.modeIcon}>{config.MODES[AppMode.DEAF].icon}</Text>
                            <Text style={styles.modeTitle}>{config.MODES[AppMode.DEAF].title}</Text>
                            <Text style={styles.modeDescription}>
                                {config.MODES[AppMode.DEAF].description}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => navigation.navigate('Settings')}
                >
                    <Text style={styles.settingsText}>⚙️ Settings</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        padding: theme.spacing.lg,
    },
    header: {
        alignItems: 'center',
        marginTop: theme.spacing.xl,
        marginBottom: theme.spacing.xxl,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.primary,
        marginBottom: theme.spacing.sm,
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    modesContainer: {
        gap: theme.spacing.lg,
    },
    modeCard: {
        borderRadius: theme.borderRadius.lg,
        overflow: 'hidden',
        ...theme.shadows.medium,
    },
    cardGradient: {
        padding: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.lg,
    },
    modeIcon: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: theme.spacing.md,
    },
    modeTitle: {
        ...theme.typography.h2,
        color: theme.colors.text,
        textAlign: 'center',
        marginBottom: theme.spacing.sm,
    },
    modeDescription: {
        ...theme.typography.body,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    settingsButton: {
        marginTop: theme.spacing.xl,
        padding: theme.spacing.md,
        borderRadius: theme.borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
    },
    settingsText: {
        ...theme.typography.body,
        color: theme.colors.text,
    },
});
