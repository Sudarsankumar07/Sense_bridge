import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const safeHaptic = async (fn: () => Promise<void>) => {
    if (Platform.OS === 'web') return;
    try {
        await fn();
    } catch (error) {
        // Haptics not supported, silently fail
    }
};

export const hapticLight = () => safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const hapticMedium = () => safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const hapticHeavy = () => safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

export const hapticSuccess = () => safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const hapticWarning = () => safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
export const hapticError = () => safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

export const hapticSelection = () => safeHaptic(() => Haptics.selectionAsync());
