import * as Speech from 'expo-speech';
import storageService from './storageService';

class VoiceEngine {
    constructor() {
        this.isSpeaking = false;
        this.speechQueue = [];
        this.isProcessingQueue = false;
        this.recognitionActive = false;

        // We'll integrate Vosk native module later
        this.voskModule = null;
    }

    // === TEXT-TO-SPEECH METHODS ===

    async speak(text, options = {}) {
        const speed = await storageService.getVoiceSpeed();

        const speechOptions = {
            language: options.language || 'en-US',
            pitch: options.pitch || 1.0,
            rate: options.rate || speed,
            onStart: () => {
                this.isSpeaking = true;
                if (options.onStart) options.onStart();
            },
            onDone: () => {
                this.isSpeaking = false;
                if (options.onDone) options.onDone();
                this.processNextInQueue();
            },
            onStopped: () => {
                this.isSpeaking = false;
                if (options.onStopped) options.onStopped();
            },
            onError: (error) => {
                this.isSpeaking = false;
                console.error('TTS error:', error);
                if (options.onError) options.onError(error);
            }
        };

        Speech.speak(text, speechOptions);
    }

    async speakWithPriority(text, options = {}) {
        // Stop current speech and speak immediately
        await this.stop();
        this.speechQueue = []; // Clear queue
        await this.speak(text, options);
    }

    async queueSpeak(text, options = {}) {
        // Add to queue
        this.speechQueue.push({ text, options });

        if (!this.isSpeaking && !this.isProcessingQueue) {
            this.processNextInQueue();
        }
    }

    processNextInQueue() {
        if (this.speechQueue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }

        this.isProcessingQueue = true;
        const { text, options } = this.speechQueue.shift();
        this.speak(text, options);
    }

    async stop() {
        await Speech.stop();
        this.isSpeaking = false;
    }

    async pause() {
        await Speech.pause();
    }

    async resume() {
        await Speech.resume();
    }

    checkIsSpeaking() {
        return this.isSpeaking;
    }

    clearQueue() {
        this.speechQueue = [];
        this.isProcessingQueue = false;
    }

    // === SPEECH-TO-TEXT METHODS (Vosk Integration) ===

    async initializeVosk() {
        // This will be implemented with native module
        // For now, return a placeholder
        console.log('Vosk initialization - native module required');
        return true;
    }

    async startListening(onResult, onPartial = null) {
        // This will use native Vosk module
        // Placeholder for now
        console.log('Start listening - native module required');
        this.recognitionActive = true;

        // Mock callback for testing
        if (__DEV__) {
            console.warn('Using mock speech recognition. Implement Vosk module for production.');
        }

        return true;
    }

    async stopListening() {
        console.log('Stop listening');
        this.recognitionActive = false;
        return true;
    }

    isListening() {
        return this.recognitionActive;
    }

    // === VOICE COMMAND PARSING ===

    parseVoiceCommand(text) {
        const normalized = text.toLowerCase().trim();

        // Mode selection commands
        if (normalized.includes('blind') && normalized.includes('mode')) {
            return { type: 'mode_select', mode: 'blind' };
        }
        if (normalized.includes('sign') && normalized.includes('mode')) {
            return { type: 'mode_select', mode: 'sign' };
        }
        if (normalized.includes('deaf') && normalized.includes('mode')) {
            return { type: 'mode_select', mode: 'deaf' };
        }

        // Single word commands
        if (normalized === 'blind') {
            return { type: 'mode_select', mode: 'blind' };
        }
        if (normalized === 'sign') {
            return { type: 'mode_select', mode: 'sign' };
        }
        if (normalized === 'deaf') {
            return { type: 'mode_select', mode: 'deaf' };
        }

        // Exit command
        if (normalized.includes('exit') || normalized.includes('back') || normalized.includes('home')) {
            return { type: 'exit' };
        }

        // Check currency (Blind mode)
        if (normalized.includes('check') && (normalized.includes('currency') || normalized.includes('money') || normalized.includes('note'))) {
            return { type: 'check_currency' };
        }

        // Settings
        if (normalized.includes('settings') || normalized.includes('setting')) {
            return { type: 'settings' };
        }

        // Help
        if (normalized.includes('help')) {
            return { type: 'help' };
        }

        // Unknown command
        return { type: 'unknown', text: normalized };
    }

    // === HELPER METHODS ===

    async getAvailableVoices() {
        // Expo Speech doesn't provide this in all platforms
        // Return default
        return ['en-US'];
    }

    async testVoice() {
        await this.speak('This is a test of the voice engine. Can you hear me clearly?');
    }
}

// Export singleton instance
export default new VoiceEngine();
