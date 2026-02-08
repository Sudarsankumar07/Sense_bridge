import voiceEngine from './voiceEngine';
import storageService from './storageService';
import * as Haptics from 'expo-haptics';

class DecisionEngine {
    constructor() {
        this.cooldowns = new Map();
        this.eventHistory = [];
        this.maxHistorySize = 100;
    }

    // Process events from AI models and decide actions
    async processEvent(event) {
        const { type, mode, data, confidence } = event;

        // Apply confidence threshold
        if (confidence && confidence < this.getConfidenceThreshold(type)) {
            console.log(`Event rejected: low confidence (${confidence})`);
            return null;
        }

        // Check throttling
        if (this.shouldThrottle(event)) {
            console.log(`Event throttled: ${type}`);
            return null;
        }

        // Store in history
        this.addToHistory(event);

        // Normalize output based on event type
        const output = this.normalizeOutput(event);

        // Execute outputs
        await this.executeOutput(output);

        // Save to database
        await storageService.addHistory(mode, type, data);

        return output;
    }

    shouldThrottle(event) {
        const { type, data } = event;
        const key = `${type}_${data.class || data.label || 'generic'}`;
        const cooldownTime = this.getCooldownTime(type);

        const lastTime = this.cooldowns.get(key);
        const now = Date.now();

        if (lastTime && (now - lastTime) < cooldownTime) {
            return true;
        }

        this.cooldowns.set(key, now);
        return false;
    }

    getCooldownTime(eventType) {
        const cooldownMap = {
            'obstacle_detected': 3000,      // 3 seconds
            'person_detected': 2000,         // 2 seconds
            'stairs_detected': 4000,         // 4 seconds
            'currency_detected': 5000,       // 5 seconds
            'sign_recognized': 2000,         // 2 seconds
            'speech_recognized': 1000,       // 1 second
            'unknown_sign': 4000,            // 4 seconds
            'unknown_word': 3000             // 3 seconds
        };

        return cooldownMap[eventType] || 3000; // Default 3 seconds
    }

    getConfidenceThreshold(eventType) {
        const thresholdMap = {
            'obstacle_detected': 0.4,
            'person_detected': 0.5,
            'stairs_detected': 0.6,
            'currency_detected': 0.7,
            'sign_recognized': 0.6,
            'speech_recognized': 0.5
        };

        return thresholdMap[eventType] || 0.5; // Default 0.5
    }

    normalizeOutput(event) {
        const { type, mode, data, confidence } = event;
        let output = {
            speech: null,
            display: null,
            vibration: null,
            action: null
        };

        switch (type) {
            case 'obstacle_detected':
                output.speech = `${data.class} ahead`;
                output.display = {
                    type: 'alert',
                    message: `⚠️ ${data.class.toUpperCase()} DETECTED`,
                    details: `Distance: ${data.distance || 'Unknown'}`
                };
                output.vibration = 'warning';
                break;

            case 'person_detected':
                output.speech = 'Person ahead';
                output.display = {
                    type: 'alert',
                    message: '👤 PERSON AHEAD',
                    details: `Confidence: ${Math.round(confidence * 100)}%`
                };
                output.vibration = 'medium';
                break;

            case 'stairs_detected':
                output.speech = 'Step detected. Be careful';
                output.display = {
                    type: 'alert',
                    message: '⚡ STEP DETECTED',
                    details: 'Proceed with caution'
                };
                output.vibration = 'heavy';
                break;

            case 'currency_detected':
                output.speech = `${data.denomination}`;
                output.display = {
                    type: 'success',
                    message: '💵 CURRENCY DETECTED',
                    details: data.denomination
                };
                output.vibration = 'success';
                break;

            case 'sign_recognized':
                output.speech = data.text;
                output.display = {
                    type: 'info',
                    message: data.text.toUpperCase(),
                    details: `Confidence: ${Math.round(confidence * 100)}%`
                };
                output.vibration = 'light';
                break;

            case 'speech_recognized':
                output.display = {
                    type: 'info',
                    message: data.text,
                    details: 'Processing...'
                };
                output.action = {
                    type: 'play_animation',
                    word: data.text
                };
                break;

            case 'unknown_sign':
                output.speech = 'Unknown sign';
                output.display = {
                    type: 'warning',
                    message: '❓ UNKNOWN SIGN',
                    details: 'Please try again'
                };
                break;

            case 'unknown_word':
                output.speech = 'Spelling out word';
                output.action = {
                    type: 'spell_word',
                    word: data.word
                };
                break;

            default:
                console.warn('Unknown event type:', type);
        }

        return output;
    }

    async executeOutput(output) {
        if (!output) return;

        // Execute in parallel
        const promises = [];

        // Speech
        if (output.speech) {
            promises.push(voiceEngine.queueSpeak(output.speech));
        }

        // Vibration
        if (output.vibration) {
            promises.push(this.triggerHaptics(output.vibration));
        }

        await Promise.all(promises);

        // Display is handled by UI components

        return output;
    }

    async triggerHaptics(vibrationType) {
        const vibrationEnabled = await storageService.isVibrationEnabled();
        if (!vibrationEnabled) return;

        try {
            switch (vibrationType) {
                case 'light':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    break;
                case 'medium':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    break;
                case 'heavy':
                case 'warning':
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    break;
                case 'success':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    break;
                case 'error':
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    break;
                default:
                    await Haptics.selectionAsync();
            }
        } catch (error) {
            console.error('Haptics error:', error);
        }
    }

    addToHistory(event) {
        this.eventHistory.unshift(event);

        // Limit history size
        if (this.eventHistory.length > this.maxHistorySize) {
            this.eventHistory = this.eventHistory.slice(0, this.maxHistorySize);
        }
    }

    getRecentEvents(count = 10) {
        return this.eventHistory.slice(0, count);
    }

    clearCooldowns() {
        this.cooldowns.clear();
    }

    clearHistory() {
        this.eventHistory = [];
    }

    reset() {
        this.clearCooldowns();
        this.clearHistory();
    }
}

// Export singleton instance
export default new DecisionEngine();
