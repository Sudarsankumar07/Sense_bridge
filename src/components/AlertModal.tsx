import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme';

type AlertModalProps = {
    visible: boolean;
    title: string;
    message: string;
    onClose: () => void;
    severity?: 'info' | 'warning' | 'danger' | 'success';
};

const getGradient = (severity: AlertModalProps['severity']) => {
    switch (severity) {
        case 'success':
            return theme.gradients.success;
        case 'warning':
        case 'danger':
            return theme.gradients.warning;
        default:
            return theme.gradients.card;
    }
};

export const AlertModal: React.FC<AlertModalProps> = ({
    visible,
    title,
    message,
    onClose,
    severity = 'info',
}) => {
    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.backdrop}>
                <LinearGradient colors={getGradient(severity)} style={styles.modal}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>
                    <TouchableOpacity style={styles.button} onPress={onClose}>
                        <Text style={styles.buttonText}>Okay</Text>
                    </TouchableOpacity>
                </LinearGradient>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing.lg,
    },
    modal: {
        width: '100%',
        borderRadius: theme.radius.lg,
        padding: theme.spacing.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        ...theme.shadows.lifted,
    },
    title: {
        ...theme.typography.h2,
        color: theme.colors.text,
        marginBottom: theme.spacing.sm,
    },
    message: {
        ...theme.typography.body,
        color: theme.colors.textMuted,
    },
    button: {
        marginTop: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: theme.colors.primary,
        alignItems: 'center',
    },
    buttonText: {
        ...theme.typography.bodyStrong,
        color: theme.colors.primary,
    },
});
