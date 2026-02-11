import React, { useRef } from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';

type ModeCardProps = {
    icon: string;
    title: string;
    description: string;
    tag?: string;
    onPress: () => void;
};

export const ModeCard: React.FC<ModeCardProps> = ({ icon, title, description, tag, onPress }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const iconBounce = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 0.97,
                ...theme.animations.spring.stiff,
                useNativeDriver: true,
            }),
            Animated.spring(iconBounce, {
                toValue: 1.1,
                ...theme.animations.spring.bouncy,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handlePressOut = () => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                ...theme.animations.spring.gentle,
                useNativeDriver: true,
            }),
            Animated.spring(iconBounce, {
                toValue: 1,
                ...theme.animations.spring.gentle,
                useNativeDriver: true,
            }),
        ]).start();
    };

    return (
        <TouchableOpacity
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            activeOpacity={1}
        >
            <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
                <LinearGradient colors={theme.gradients.glassCard} style={styles.card}>
                    <View style={styles.headerRow}>
                        <Animated.View style={[styles.iconContainer, { transform: [{ scale: iconBounce }] }]}>
                            <MaterialCommunityIcons
                                name={icon as any}
                                size={36}
                                color={theme.colors.primary}
                            />
                        </Animated.View>
                        {tag ? (
                            <View style={styles.tag}>
                                <Text style={styles.tagText}>{tag}</Text>
                            </View>
                        ) : null}
                    </View>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.description}>{description}</Text>
                    <View style={styles.cta}>
                        <Text style={styles.ctaText}>Open Mode →</Text>
                    </View>
                </LinearGradient>
            </Animated.View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        ...theme.shadows.soft,
    },
    card: {
        padding: theme.spacing.lg,
        ...theme.glassmorphism.card,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing.md,
    },
    iconContainer: {
        width: 50,
        height: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tag: {
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: theme.radius.pill,
        backgroundColor: 'rgba(124,255,178,0.16)',
        borderWidth: 1,
        borderColor: 'rgba(124,255,178,0.35)',
        ...theme.shadows.glowAccent,
    },
    tagText: {
        ...theme.typography.caption,
        color: theme.colors.accent,
        fontWeight: '600',
    },
    title: {
        ...theme.typography.h2,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
    },
    description: {
        ...theme.typography.body,
        color: theme.colors.textMuted,
        marginBottom: theme.spacing.md,
        lineHeight: 22,
    },
    cta: {
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.pill,
        backgroundColor: 'rgba(61,214,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(61,214,255,0.3)',
    },
    ctaText: {
        ...theme.typography.caption,
        color: theme.colors.primary,
        fontWeight: '600',
    },
});
