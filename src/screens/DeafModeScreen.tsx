import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';
import { startListening } from '../services/cloudAI/speechToText';

export const DeafModeScreen: React.FC = () => {
    const [transcripts, setTranscripts] = useState<string[]>([]);

    useEffect(() => {
        const interval = setInterval(async () => {
            const result = await startListening();
            setTranscripts(prev => [result.text, ...prev].slice(0, 8));
        }, 3500);

        return () => clearInterval(interval);
    }, []);

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <LinearGradient colors={theme.gradients.hero} style={styles.hero}>
                <Text style={styles.title}>Deaf Mode</Text>
                <Text style={styles.subtitle}>Speech to text with avatar-ready output.</Text>
            </LinearGradient>

            <View style={styles.content}>
                <View style={styles.statusCard}>
                    <Text style={styles.statusLabel}>Listening</Text>
                    <Text style={styles.statusValue}>Live speech transcription active</Text>
                </View>

                <FlatList
                    data={transcripts}
                    keyExtractor={(item, index) => `${item}-${index}`}
                    renderItem={({ item }) => (
                        <View style={styles.transcriptCard}>
                            <Text style={styles.transcriptText}>{item}</Text>
                        </View>
                    )}
                    ListEmptyComponent={<Text style={styles.empty}>Waiting for speech input...</Text>}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    hero: {
        padding: theme.spacing.lg,
    },
    title: {
        ...theme.typography.h1,
        color: theme.colors.text,
    },
    subtitle: {
        ...theme.typography.body,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.sm,
    },
    content: {
        flex: 1,
        padding: theme.spacing.lg,
    },
    statusCard: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.lg,
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        marginBottom: theme.spacing.lg,
    },
    statusLabel: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        textTransform: 'uppercase',
    },
    statusValue: {
        ...theme.typography.bodyStrong,
        color: theme.colors.text,
        marginTop: theme.spacing.sm,
    },
    listContent: {
        gap: theme.spacing.md,
        paddingBottom: theme.spacing.xl,
    },
    transcriptCard: {
        padding: theme.spacing.md,
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.surfaceAlt,
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    transcriptText: {
        ...theme.typography.body,
        color: theme.colors.text,
    },
    empty: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
    },
});
