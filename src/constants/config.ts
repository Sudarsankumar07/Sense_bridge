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
        OBSTACLE: ['obstacle', 'obstacle scan', 'obstacle detection'],
        CURRENCY: ['currency', 'currency scan', 'currency detection'],
        NAVIGATE: ['navigate', 'navigation', 'directions', 'take me to'],
        STOP_NAVIGATION: ['stop navigation', 'stop navigating', 'cancel navigation', 'end navigation'],
        BACK: ['go back', 'back', 'exit', 'quit', 'close'],
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

    // Navigation Settings
    NAVIGATION: {
        ARRIVAL_THRESHOLD: 20,             // meters — consider "arrived"
        INSTRUCTION_REPEAT_INTERVAL: 15000, // ms — re-announce current step
        UPCOMING_TURN_DISTANCE: 30,        // meters — announce upcoming turn
        GPS_UPDATE_INTERVAL: 3000,         // ms
        GPS_DISTANCE_FILTER: 5,            // meters — minimum movement to trigger update
    },

    // Voice Settings
    VOICE: {
        DEFAULT_SPEED: 1.0,
        MIN_SPEED: 0.5,
        MAX_SPEED: 2.0,
        LANGUAGE: 'en-US',
    },

    // API Endpoints
    API: {
        OBJECT_DETECTION: 'https://detect.roboflow.com',
        CURRENCY_DETECTION: 'https://detect.roboflow.com',
        GOOGLE_VISION: 'https://vision.googleapis.com/v1/images:annotate',
        SIGN_LANGUAGE: 'https://api-inference.huggingface.co/models',
        ORS_GEOCODE: 'https://api.openrouteservice.org/geocode/search',
        ORS_DIRECTIONS: 'https://api.openrouteservice.org/v2/directions/foot-walking',
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
        NAV_ASK_DESTINATION: 'Where would you like to go? Say the place name.',
        NAV_SEARCHING: (query: string) => `Searching for ${query}`,
        NAV_NOT_FOUND: 'Could not find that location. Please try again.',
        NAV_STARTED: (dest: string, dist: string) => `Navigation started to ${dest}. Total distance ${dist}.`,
        NAV_ARRIVED: 'You have arrived at your destination.',
        NAV_STOPPED: 'Navigation stopped.',
        NAV_TURN: (instruction: string, distance: string) => `In ${distance}, ${instruction}`,
    },
};

export default config;
