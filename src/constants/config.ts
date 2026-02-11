import { AppMode } from '../types';

export const config = {
    // App Info
    APP_NAME: 'SenseBridge',
    VERSION: '1.0.0',

    // Mode Definitions
    MODES: {
        [AppMode.BLIND]: {
            title: 'Blind Mode',
            description: 'Obstacle and currency detection with voice alerts',
            icon: 'eye-off',
        },
        [AppMode.SIGN]: {
            title: 'Sign Mode',
            description: 'Sign language to text and voice conversion',
            icon: 'hand-wave',
        },
        [AppMode.DEAF]: {
            title: 'Deaf Mode',
            description: 'Speech to text with sign avatar',
            icon: 'ear-hearing-off',
        },
    },

    // Voice Commands
    VOICE_COMMANDS: {
        BLIND_MODE: ['blind mode', 'blind', 'obstacle detection'],
        SIGN_MODE: ['sign mode', 'sign language', 'sign'],
        DEAF_MODE: ['deaf mode', 'deaf', 'avatar mode'],
        EXIT: ['exit', 'quit', 'close'],
        REPEAT: ['repeat', 'say again'],
        SETTINGS: ['settings', 'preferences'],
    },

    // Detection Thresholds
    DETECTION: {
        CONFIDENCE_THRESHOLD: 0.6,
        DISTANCE_THRESHOLD: 3.0, // meters
        FRAMES_FOR_CURRENCY: 5, // frames to average for currency detection
        ALERT_COOLDOWN: 2000, // milliseconds
    },

    // Voice Settings
    VOICE: {
        DEFAULT_SPEED: 1.0,
        MIN_SPEED: 0.5,
        MAX_SPEED: 2.0,
        LANGUAGE: 'en-US',
    },

    // API Endpoints (will be replaced with actual cloud APIs)
    API: {
        OBJECT_DETECTION: 'https://api-inference.huggingface.co/models/facebook/detr-resnet-50',
        CURRENCY_DETECTION: 'https://detect.roboflow.com',
        SIGN_LANGUAGE: 'https://api-inference.huggingface.co/models',
    },

    // Camera Settings
    CAMERA: {
        FRAME_RATE: 10, // FPS for processing
        QUALITY: 0.7, // Image quality for API calls
    },

    // Welcome Messages
    MESSAGES: {
        WELCOME: 'Welcome to SenseBridge. Say Blind Mode, Sign Mode, or Deaf Mode to begin.',
        MODE_SELECTED: (mode: string) => `${mode} activated`,
        OBSTACLE_DETECTED: (object: string, distance: number) =>
            `${object} detected ${distance.toFixed(1)} meters ahead`,
        CURRENCY_DETECTED: (amount: number) => `${amount} rupees detected`,
    },
};

export default config;
