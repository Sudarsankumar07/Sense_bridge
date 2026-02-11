import config from '../constants/config';
import { CurrencyDetection, ObjectDetection, SignDetection } from '../types';

const lastAlertMap = new Map<string, number>();

export type AlertPayload = {
    id: string;
    message: string;
    severity: 'info' | 'warning' | 'danger' | 'success';
};

export const shouldTriggerAlert = (key: string, cooldown = config.DETECTION.ALERT_COOLDOWN) => {
    const now = Date.now();
    const last = lastAlertMap.get(key) ?? 0;
    if (now - last < cooldown) return false;
    lastAlertMap.set(key, now);
    return true;
};

export const buildObstacleAlert = (detection: ObjectDetection): AlertPayload | null => {
    if (detection.confidence < config.DETECTION.CONFIDENCE_THRESHOLD) return null;
    const distance = detection.distance ?? 3.5;
    if (distance > config.DETECTION.DISTANCE_THRESHOLD) return null;

    return {
        id: `obstacle-${detection.class}`,
        message: config.MESSAGES.OBSTACLE_DETECTED(detection.class, distance),
        severity: distance < 1.5 ? 'danger' : 'warning',
    };
};

export const buildCurrencyAlert = (detection: CurrencyDetection): AlertPayload => ({
    id: `currency-${detection.denomination}`,
    message: config.MESSAGES.CURRENCY_DETECTED(detection.denomination),
    severity: 'success',
});

export const buildSignOutput = (detection: SignDetection) => detection.text || detection.sign;

export const resetDecisionEngine = () => {
    lastAlertMap.clear();
};
