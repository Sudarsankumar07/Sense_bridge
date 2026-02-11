import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { CameraView, CameraType } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../theme';

type CameraViewProps = {
    cameraRef: React.RefObject<CameraView>;
    label?: string;
};

export const CameraViewComponent: React.FC<CameraViewProps> = ({ cameraRef, label }) => {
    // Camera doesn't work on web, show placeholder
    if (Platform.OS === 'web') {
        return (
            <View style={styles.wrapper}>
                <View style={[styles.camera, styles.placeholder]}>
                    <MaterialCommunityIcons name="camera-off" size={48} color={theme.colors.textMuted} />
                    <Text style={styles.placeholderText}>Camera only works on mobile devices</Text>
                    <Text style={styles.placeholderSubtext}>
                        Run this app on iOS or Android to use camera features
                    </Text>
                </View>
                <View style={styles.overlay}>
                    <Text style={styles.label}>{label ?? 'Live Camera'}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.wrapper}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />            <View style={styles.overlay}>
                <Text style={styles.label}>{label ?? 'Live Camera'}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
    },
    camera: {
        width: '100%',
        height: 220,
    },
    placeholder: {
        backgroundColor: theme.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
    },
    placeholderText: {
        ...theme.typography.bodyStrong,
        color: theme.colors.textMuted,
        marginTop: theme.spacing.sm,
    },
    placeholderSubtext: {
        ...theme.typography.caption,
        color: theme.colors.textMuted,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.xl,
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: theme.spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.45)',
    },
    label: {
        ...theme.typography.caption,
        color: theme.colors.text,
    },
});
